node-transifex
=====================

[![Build Status](https://travis-ci.org/alicoding/node-transifex.png)](https://travis-ci.org/alicoding/node-transifex)

[Transifex](http://www.transifex.com) API client for nodejs

Install the node.js module using npm:

`$ npm install transifex`

Initialize the module with your credential and project name for the first time

``` javascript
var Transifex = require("transifex");

var transifex = new Trasifex({
	project_slug: "projectName",
	credential: "user:pass" // In the same format
});
```

## API
The module exposes a number of useful functions, including:

### Project API

#### projectSetMethods

The `projectSetMethods` function returns a list of (slug, name, description, source_language_code) for all projects the user has access to in JSON format. This method supports pagination through the options start and end.

``` javascript
transifex.projectSetMethods(options, function(err, data) {
  ...
});
```

Return all the projects in Transifex

or

``` javascript
transifex.projectSetMethods({ start: 1, end: 20 }, function(err, data) {
  ...
});
```

Return only the first 20 projects from the list.

#### projectInstanceMethods

The `projectInstanceMethods` function returns the fields slug, name, description and source_language_code for the project of the specified slug in JSON format includes the above fields as well as the following ones:

* long_description
* homepage
* feed
* created
* anyone_submit
* bug_tracker
* trans_instructions
* a list of tags
* outsource
* auto_join
* a list of the maintainers' username
* the username of the owner of the project
* a list of the resources of the project containing the fields slug and name.
* a list of language codes for the teams created for the project.
* fill_up_resources, a boolean to specify whether the system will fill up

``` javascript
transifex.projectInstanceMethods("transifex", function(err, data) {
  ...
});
```

### Resource API

#### resourcesSetMethod

The `resourcesSetMethod` function returns a JSON-encoded list with the fields slug, name, i18n_type, source_language_code and the category of the resources that belong to the specified project.

``` javascript
transifex.resourcesSetMethod("transifex", function(err, data) {
  ...
});
```

#### resourcesInstanceMethods

The `resourcesInstanceMethods` function returns a JSON encoded string with the details for the resource. The default fields returned are the name, the slug, the i18n_type, the source_language of the resource, its priority and the category. If the boolean in third parameter set to `true`, then extra fields are returned:

* created
* available_languages
* project_slug
* wordcount
* total_entities
* accept_translations
* last_update

*** Third parameter is option, and set to true by default.***

``` javascript
transifex.resourcesInstanceMethods("webmaker", "slug_name", true, function(err, data) {
  ...
});
```

**Example**

```
...

{
    "slug": "txc"
    "mimetype": "text/x-po",
    "source_language_code": "en",
    "wordcount": 6160,
    "total_entities": 1017,
    "last_update": "2011-12-05 19:59:55",
    "available_languages": [
        {
            "code_aliases": " ",
            "code": "sq",
            "name": "Albanian"
        },
        ...
    ],
}
```

#### sourceLanguageMethods

The `sourceLanguageMethods` function returns the translation in the source language of the resource.

``` javascript
transifex.sourceLanguageMethods("webmaker", "profile", function(err, data) {
  ...
});
```

**Example**

```
{ permissionHelp: 'Your browser will now ask you for permission to use your camera. This will usually be at the top of your window.',
  photo: 'GIF',
  poweredBy: 'Powered by <a href="http://www.webmaker.org" target="_blank">Webmaker</a>',
  ...
  ...
  ...
  Done: 'Done',
  Likes: 'Likes',
  login: 'Login' }
```

**Note:** The responded content is not parsed.

### Language API

#### languageSetMethod

The `languageSetMethod` function returns a JSON encoded list with the fields language_code, coordinators, translators and reviewers that are responsible and work on the languages that belong to the project.

***Only the project owner or the project maintainers have access to this method.***

``` javascript
transifex.languageSetMethod("webmaker", function(err, data) {
  ...
});
```

**Example**

```
[
 {
  'language_code': 'el',
  'coordinators': [
   'kbairak',
   'glezos'
  ],
  'translators': [
   'mpessas',
   'jkal',
  ],
  reviewers: [
   'sawidis',
   'ilias'
  ]
 },
 {
  'language_code': 'hi',
  'coordinators': [
   'rajeshr',
   'rtnpro'
  ],
  'translators': [
   'sayan'
  ],
  reviewers: [
   'chandankumar'
  ]
 }
]
```

#### languageInstanceMethod

The `languageInstanceMethod` function returns a JSON encoded string with the fields language_code, coordinators, translators and reviewers for the specified language. If the boolean in third parameter set to `true`, then extra fields are returned:

* translated_segments
* untranslated_segments
* reviewed_segments
* total_segments
* translated_words
* list
* completed_percentage

**Third parameter is optional. It is set to true by default**

***Only the project owner, the maintainers and the people working on the translations for that language may access this method.***

``` javascript
transifex.languageInstanceMethod("webmaker", "th_TH", false, function(err, data) {
  ...
});
```

#### contributorListFor

The `contributorListFor` function accept one of the three type of contributor, "coordinators", "reviewers" or "translators". It will returns a JSON list of the username of the specify type for the language of the project.

***Only the project owner, the maintainers and the people working on the translations for that language may access this method.***

``` javascript
transifex.contributorListFor("webmaker", "th_TH", "<type_of_contributor>", function(err, data) {
  ...
});
```

**Example**

```
{ coordinators: [
    'glezos',
    'kbairak'
  ]
}
```

#### listOfContributors

The `listOfContributors` function returns unique list of array of all the contributors in the project. The list also sorted in an alphabetical order.

``` javascript
transifex.listOfContributors(function(err, data) {
  ...
});
```

**Example**

```
[
  "123_ayesha098",
  "3ar7hkung",
  "aali",
  "Abdelhak",
  "adityaputra",
  "adraga",
  "agnusdark",
  "ahkeno",
  "ahmedjubayer",
  "ahsan_hq",
  "akenygren",
  "alexfuser",
  "alexlakatos",
  "alexxed",
  "alfasst",
  "amaciel"
  ...
  ...
]
```

### Translations API

#### translationInstanceMethod

The `translationInstanceMethod` function returns the requested translation, if it exists. The translation is returned as a serialized string with the type name e.g. type `po` or `json`. Type also refer to the file extension. Moreover, you can specify the mode of the downloaded file with the `status` in the **fourth** parameter. The available modes are:

* default: to include all translated strings in the response.
* reviewed: to include only reviewed strings in the response.
* translator: to get a response suitable for offline translations.

``` javascript
transifex.translationInstanceMethod("webmaker", "profile", "zh_CN", { mode: "reviewed" }, function(err, data, type) {
  ...
});
```

`status` ***is optional. By default it will include all translated strings in the response (As mentioned in the default option).***

**Note:** The responded content is not parsed.

#### translationStringsMethod

The `translationStringsMethod` function returns the requested translation strings, if they exists. The translation strings are returned as `json`.

``` javascript
transifex.translationStringsMethod("webmaker", "profile", "cs", function(err, data) {
  ...
});
```

**Note:** The returned content is not parsed.

### Statistics API

#### statisticsMethods

The `statisticsMethods` function returns the statistics for the specified resource. If the language_code part is given, statistics are returned only for that specific language. Otherwise, statistics are returned for all available languages. The specific data returned per language are:

* completed: the percentage of the resource that has been translated for the language.
* translated_entities: the number of entities that have been translated for the language.
* untranslated_entities: the number of entities that have not been translated for the language.
* translated_words: the number of words that have been translated for the language.
* untranslated_words: the number of words that have not been translated for the language.
* last_update: the date and time that the last update for this translation took place.
* last_committer: the username of the last user to have updated the translation for the language.
* reviewed: the number of entities which have been reviewed for the language.
* reviewed_percentage: the percentage of entities that have been reviewed for the language.

``` javascript
transifex.statisticsMethods("webmaker", "profile", "zh_CN", function(err, data) {
...
});
```

***Language code in the third parameter is optional. If not specified it will return all the available languages***

**Example**

```
{
    "en": {
        "completed": "100%",
        "untranslated_words": 0,
        "last_commiter": "mpessas",
        "last_update": "2011-12-05 19:59:52",
        "translated_entities": 1017,
        "translated_words": 6160,
        "untranslated_entities": 0
    },
    "gu": {
        "completed": "43%",
        "untranslated_words": 4572,
        "last_commiter": "mpessas",
        "last_update": "2011-12-05 19:59:53",
        "translated_entities": 439,
        "translated_words": 1588,
        "untranslated_entities": 578
    },
    ...
}
```

#### languageStatisticsMethods

The `languageStatisticsMethods` function returns the statistics for all the resource_slug for the specified language_code. The specific data returned per language are:

* completed: the percentage of the resource that has been translated for the language.
* translated_entities: the number of entities that have been translated for the language.
* untranslated_entities: the number of entities that have not been translated for the language.
* translated_words: the number of words that have been translated for the language.
* untranslated_words: the number of words that have not been translated for the language.
* last_update: the date and time that the last update for this translation took place.
* last_committer: the username of the last user to have updated the translation for the language.
* reviewed: the number of entities which have been reviewed for the language.
* reviewed_percentage: the percentage of entities that have been reviewed for the language.

``` javascript
transifex.languageStatisticsMethods("es", function(err, data) {
  ...
});
```

**Example**
```
{
  "popcorn": {
    "reviewed_percentage": "0%",
    "completed": "6%",
    "untranslated_words": 1040,
    "last_commiter": "aali",
    "reviewed": 0,
    "translated_entities": 16,
    "translated_words": 18,
    "last_update": "2013-11-05 16:27:54",
    "untranslated_entities": 248
  },
...
...
...
  "weblit": {
    "reviewed_percentage": "0%",
    "completed": "18%",
    "untranslated_words": 810,
    "last_commiter": "hasany81",
    "reviewed": 0,
    "translated_entities": 20,
    "translated_words": 64,
    "last_update": "2013-10-17 10:46:28",
    "untranslated_entities": 88
  }
}
```

#### projectStatisticsMethods

The `projectStatisticsMethods` function returns the statistics for all the resource_slug in all the language_code for the whole project. The specific data returned per language and resource_slug are:

* completed: the percentage of the resource that has been translated for the language.
* translated_entities: the number of entities that have been translated for the language.
* untranslated_entities: the number of entities that have not been translated for the language.
* translated_words: the number of words that have been translated for the language.
* untranslated_words: the number of words that have not been translated for the language.
* last_update: the date and time that the last update for this translation took place.
* last_committer: the username of the last user to have updated the translation for the language.
* reviewed: the number of entities which have been reviewed for the language.
* reviewed_percentage: the percentage of entities that have been reviewed for the language.

``` javascript
transifex.projectStatisticsMethods(function(err, data) {
  ...
});
```

**Example**

```
  { `resource_slug_name`: {
     hu:
      { reviewed_percentage: '0%',
        completed: '0%',
        untranslated_words: 111,
        last_commiter: 'aali',
        reviewed: 0,
        translated_entities: 0,
        translated_words: 0,
        last_update: '2013-11-01 19:04:36',
        untranslated_entities: 22 },
        ...
        ...
        ...
     fa:
      { reviewed_percentage: '0%',
        completed: '0%',
        untranslated_words: 111,
        last_commiter: 'aali',
        reviewed: 0,
        translated_entities: 0,
        translated_words: 0,
        last_update: '2013-10-26 19:53:27',
        untranslated_entities: 22 },
     hi:
      { reviewed_percentage: '0%',
        completed: '0%',
        untranslated_words: 111,
        last_commiter: 'aali',
        reviewed: 0,
        translated_entities: 0,
        translated_words: 0,
        last_update: '2013-10-18 19:13:32',
        untranslated_entities: 22 } } }
```

### Language Info API

#### languageInstanceMethods

The `languageInstanceMethods` function returns the fields name, code, nplurals and pluralequation for the language associated with the specified code in JSON format.

``` javascript

transifex.languageInstanceMethods("th_TH", function(err, data) {
  ...
});
```

**Example**
```
{
  rtl: false,
  pluralequation: "language.pluralequation",
  code: "th_TH",
  name: "Thai (Thailand)",
  nplurals: 1
}
```

#### languageSetMethods

The `languageSetMethods` function returns the fields name, code, nplurals and pluralequation for all languages supported by Transifex in JSON format.

``` javascript
transifex.languageSetMethods(function(err, data) {
  ...
});
```

#### languageSetInfoMethods

The `languageSetInfoMethods` function returns the field name and code for all languages available in the project.

``` javascript
transifex.languageSetInfoMethods(function(err, data) {
  ...
});
```

**Example**

```
[ { locale: 'cs', name: 'Czech' },
  { locale: 'el', name: 'Greek' },
  { locale: 'bn_IN', name: 'Bengali (India)' },
  { locale: 'ar', name: 'Arabic' },
  { locale: 'de', name: 'German' },
  { locale: 'es', name: 'Spanish' },
  { locale: 'en_GB', name: 'English (United Kingdom)' },
  { locale: 'eu', name: 'Basque' },
  { locale: 'fi', name: 'Finnish' },
  { locale: 'fa', name: 'Persian' },
  { locale: 'fr', name: 'French' },
  { locale: 'gl', name: 'Galician' },
  { locale: 'he', name: 'Hebrew' },
  { locale: 'hi', name: 'Hindi' },
  { locale: 'hu', name: 'Hungarian' },
  { locale: 'id', name: 'Indonesian' },
  { locale: 'it', name: 'Italian' },
  { locale: 'ja', name: 'Japanese' },
  { locale: 'ml', name: 'Malayalam' },
  { locale: 'mr', name: 'Marathi' },
  { locale: 'ms', name: 'Malay' },
  { locale: 'my', name: 'Burmese' },
  { locale: 'nb', name: 'Norwegian Bokmål' },
  { locale: 'ne', name: 'Nepali' },
  { locale: 'nl', name: 'Dutch' },
  { locale: 'pt', name: 'Portuguese' }]
```
