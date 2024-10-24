import React from 'react';
import { SelectWidgetComponent } from './SelectWidget';
import { injectLazyLibs } from '@plone/volto/helpers/Loadable/Loadable';
import { RealStoreWrapper as Wrapper } from '@plone/volto/storybook';

const SelectComponent = injectLazyLibs([
  'reactSelect',
  'reactSelectAsyncPaginate',
])(SelectWidgetComponent);

const Select = (args) => {
  const [value, setValue] = React.useState(args.value ?? '');
  const onChange = (block, value) => {
    // args.onChange({ value });
    setValue(value);
  };

  return (
    <Wrapper>
      <SelectComponent {...args} onChange={onChange} value={value} />
    </Wrapper>
  );
};

export const Default = Select.bind({});
Default.args = {
  id: 'field-empty',
  title: 'field 1 title',
  description: 'Optional help text',
  placeholder: 'Type something…',
  choices: [
    ['Foo', 'Foo'],
    ['Bar', 'Bar'],
    ['FooBar', 'FooBar'],
  ],
};

export const Required = Select.bind({});
Required.args = {
  id: 'field-empty',
  title: 'field 1 title',
  description: 'Optional help text',
  placeholder: 'Type something…',
  choices: [
    ['Foo', 'Foo'],
    ['Bar', 'Bar'],
    ['FooBar', 'FooBar'],
  ],
  required: true,
};

export const Filled = Select.bind({});
Filled.args = {
  id: 'field-filled',
  title: 'Filled field title',
  description: 'Optional help text',
  choices: [
    ['Foo', 'Foo'],
    ['Bar', 'Bar'],
    ['FooBar', 'FooBar'],
  ],
  value: 'Foo',
  placeholder: 'Type something…',
  required: true,
};

export const Errored = Select.bind({});
Errored.args = {
  id: 'field-errored',
  title: 'Errored field title',
  description: 'Optional help text',
  placeholder: 'Type something…',
  // Simplest example in Plone - a "hardcoded, hand made" vocab using SimpleVocabulary/SimpleTerm
  // allow_discussion = schema.Choice(
  //     title=_(u'Allow discussion'),
  //     description=_(u'Allow discussion for this content object.'),
  //     vocabulary=SimpleVocabulary([
  //       SimpleTerm(value=True, title=_(u'Yes')),
  //       SimpleTerm(value=False, title=_(u'No')),
  //     ]),
  //     required=False,
  //     default=None,
  // )
  choices: [
    ['Foo', 'Foo'],
    ['Bar', 'Bar'],
    ['FooBar', 'FooBar'],
  ],
  value: 'Foo',
  error: ['This is the error'],
  required: true,
};

export const NoPlaceholder = Select.bind({});
NoPlaceholder.args = {
  id: 'field-without-novalue',
  title: 'Field title',
  description: 'This field has no value option',
  choices: [
    ['Foo', 'Foo'],
    ['Bar', 'Bar'],
    ['FooBar', 'FooBar'],
  ],
  required: true,
};

export const WithoutNoValueOption = Select.bind({});
WithoutNoValueOption.args = {
  id: 'field-without-novalue',
  title: 'Field title',
  description: 'This field has no value option',
  placeholder: 'Select something…',
  choices: [
    ['Foo', 'Foo'],
    ['Bar', 'Bar'],
    ['FooBar', 'FooBar'],
  ],
  required: true,
  noValueOption: false,
};

export const VocabularyBased = Select.bind({});
VocabularyBased.args = {
  id: 'field-vocab-based',
  title: 'field title',
  description: 'This is a vocab-based field (AsyncSelect based)',
  placeholder: 'Select something…',
  // choices in Vocabulary based selects that has choices and spects a string in return
  // Use case: Language select - A Choice schema that spects a string as value
  //   language = schema.Choice(
  //     title=_(u'label_language', default=u'Language'),
  //     vocabulary='plone.app.vocabularies.SupportedContentLanguages',
  //     required=False,
  //     missing_value='',
  //     defaultFactory=default_language,
  // )
  // p.restapi vocab endpoint outputs
  // "items": [{title: "English", token: "en"}, ...]
  // The widget sends a string as value in the PATCH/POST:
  // value: "en"
  choices: [
    { label: 'English', value: 'en' },
    { label: 'Catala', value: 'ca' },
  ],
  required: true,
  vocabBaseUrl: 'https://anapivocabularyURL',
};

export const Disabled = Select.bind({});
Disabled.args = {
  id: 'field-disabled',
  title: 'Disabled field title',
  description: 'This select field is disabled',
  disabled: true,
};

export default {
  title: 'Widgets/Select Widget',
  component: SelectComponent,
  decorators: [
    (Story) => (
      <div style={{ width: '400px' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    // controlled value prop
    value: {
      control: {
        disable: true,
      },
    },
  },
  // excludeStories: ['searchResults'],
  // subcomponents: { ArgsTable },
};
