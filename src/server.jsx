/* eslint no-console: 0 */
import '@plone/volto/config'; // This is the bootstrap for the global config - server side
import { existsSync, lstatSync, readFileSync } from 'fs';
import React from 'react';
import { StaticRouter } from 'react-router-dom';
import { Provider } from 'react-intl-redux';
import express from 'express';
import { renderToString } from 'react-dom/server';
import { createMemoryHistory } from 'history';
import { parse as parseUrl } from 'url';
import { keys } from 'lodash';
import cookie, { plugToRequest } from 'react-cookie';
import locale from 'locale';
import { detect } from 'detect-browser';
import path from 'path';
import { ChunkExtractor, ChunkExtractorManager } from '@loadable/server';
import { resetServerContext } from 'react-beautiful-dnd';
import debug from 'debug';

import routes from '~/routes';
import config from '@plone/volto/registry';

import {
  flattenToAppURL,
  Html,
  Api,
  persistAuthToken,
  normalizeLanguageName,
} from '@plone/volto/helpers';
import { changeLanguage } from '@plone/volto/actions';

import userSession from '@plone/volto/reducers/userSession/userSession';

import ErrorPage from '@plone/volto/error';

import languages from '@plone/volto/constants/Languages';

import configureStore from '@plone/volto/store';
import { ReduxAsyncConnect, loadOnServer } from './helpers/AsyncConnect';

let locales = {};

if (config.settings) {
  config.settings.supportedLanguages.forEach((lang) => {
    const langFileName = normalizeLanguageName(lang);
    import('~/../locales/' + langFileName + '.json').then((locale) => {
      locales = { ...locales, [lang]: locale.default };
    });
  });
}

function reactIntlErrorHandler(error) {
  debug('i18n')(error);
}

const supported = new locale.Locales(keys(languages), 'en');

console.log('pub', process.env.RAZZLE_PUBLIC_DIR);

const server = express()
  .disable('x-powered-by')
  .use(express.static(process.env.RAZZLE_PUBLIC_DIR))
  .use('/freshwater', express.static(process.env.RAZZLE_PUBLIC_DIR))
  .head('/*', function (req, res) {
    // Support for HEAD requests. Required by start-test utility in CI.
    res.send('');
  })
  .all('*', (req, res, next) => {
    plugToRequest(req, res);
    next();
  });

const middleware = (config.settings.expressMiddleware || []).filter((m) => m);

server.all('*', setupServer);
if (middleware.length) server.use('/', middleware);

function setupServer(req, res, next) {
  const api = new Api(req);

  const browserdetect = detect(req.headers['user-agent']);

  const lang = new locale.Locales(
    cookie.load('I18N_LANGUAGE') ||
      config.settings.defaultLanguage ||
      req.headers['accept-language'],
  )
    .best(supported)
    .toString();

  const authToken = cookie.load('auth_token');
  const initialState = {
    userSession: { ...userSession(), token: authToken },
    form: req.body,
    intl: {
      defaultLocale: 'en',
      locale: lang,
      messages: locales[lang],
    },
    browserdetect,
  };

  const history = createMemoryHistory({
    initialEntries: [req.url],
  });

  // Create a new Redux store instance
  const store = configureStore(initialState, history, api);

  persistAuthToken(store);

  function errorHandler(error) {
    const errorPage = (
      <Provider store={store} onError={reactIntlErrorHandler}>
        <StaticRouter context={{}} location={req.url}>
          <ErrorPage message={error.message} />
        </StaticRouter>
      </Provider>
    );

    res.set({
      'Cache-Control': 'public, max-age=60, no-transform',
    });

    /* Displays error in console
     * TODO:
     * - get ignored codes from Plone error_log
     */
    const ignoredErrors = [301, 302, 401, 404];
    if (!ignoredErrors.includes(error.status)) console.error(error);

    res
      .status(error.status || 500) // If error happens in Volto code itself error status is undefined
      .send(`<!doctype html> ${renderToString(errorPage)}`);
  }

  if (!process.env.RAZZLE_API_PATH && req.headers.host) {
    req.app.locals.detectedHost = `${
      req.headers['x-forwarded-proto'] || req.protocol
    }://${req.headers.host}`;
    config.settings.apiPath = req.app.locals.detectedHost;
    config.settings.publicURL = req.app.locals.detectedHost;
  }

  req.app.locals = {
    ...req.app.locals,
    store,
    api,
    errorHandler,
  };

  next();
}

server.get('/*', (req, res) => {
  const { store, api, errorHandler } = req.app.locals;

  // @loadable/server extractor
  const extractor = new ChunkExtractor({
    statsFile: path.resolve('build/loadable-stats.json'),
    entrypoints: ['client'],
    publicPath: process.env.RAZZLE_PREFIX_PATH || '',
  });

  const url = req.originalUrl || req.url;
  const location = parseUrl(url);

  loadOnServer({ store, location, routes, api })
    .then(() => {
      // The content info is in the store at this point thanks to the asynconnect
      // features, then we can force the current language info into the store when
      // coming from an SSR request
      const updatedLang =
        store.getState().content.data?.language?.token ||
        config.settings.defaultLanguage;

      store.dispatch(changeLanguage(updatedLang, locales[updatedLang]));

      const context = {};
      resetServerContext();
      const markup = renderToString(
        <ChunkExtractorManager extractor={extractor}>
          <Provider store={store} onError={reactIntlErrorHandler}>
            <StaticRouter context={context} location={req.url}>
              <ReduxAsyncConnect routes={routes} helpers={api} />
            </StaticRouter>
          </Provider>
        </ChunkExtractorManager>,
      );

      const readCriticalCss =
        config.settings.serverConfig.readCriticalCss || defaultReadCriticalCss;

      if (context.url) {
        res.redirect(flattenToAppURL(context.url));
      } else if (context.error_code) {
        res.set({
          'Cache-Control': 'no-cache',
        });

        res.status(context.error_code).send(
          `<!doctype html>
              ${renderToString(
                <Html
                  extractor={extractor}
                  markup={markup}
                  store={store}
                  extractScripts={
                    config.settings.serverConfig.extractScripts?.errorPages ||
                    process.env.NODE_ENV !== 'production'
                  }
                  criticalCss={readCriticalCss(req)}
                  apiPath={
                    req.app.locals.detectedHost || config.settings.apiPath
                  }
                  publicURL={
                    req.app.locals.detectedHost || config.settings.publicURL
                  }
                />,
              )}
            `,
        );
      } else {
        res.status(200).send(
          `<!doctype html>
              ${renderToString(
                <Html
                  extractor={extractor}
                  markup={markup}
                  store={store}
                  criticalCss={readCriticalCss(req)}
                  apiPath={
                    req.app.locals.detectedHost || config.settings.apiPath
                  }
                  publicURL={
                    req.app.locals.detectedHost || config.settings.publicURL
                  }
                />,
              )}
            `,
        );
      }
    }, errorHandler)
    .catch(errorHandler);
});

export const defaultReadCriticalCss = () => {
  const { criticalCssPath } = config.settings.serverConfig;

  const e = existsSync(criticalCssPath);
  if (!e) return;

  const f = lstatSync(criticalCssPath);
  if (!f.isFile()) return;

  return readFileSync(criticalCssPath, { encoding: 'utf-8' });
};

// Exposed for the console bootstrap info messages
server.apiPath = config.settings.apiPath;
server.devProxyToApiPath = config.settings.devProxyToApiPath;
server.publicURL = config.settings.publicURL;

export default server;
