# jQuery-QueryBuilder-Subfield
Standalone Subfield plugin for the [Query Builder](http://querybuilder.js.org/).

This plugin adds the capability of showing a free-form text field when choosing a filter. It handles combining the filter select field with the freeform text with a custom subfield separator. It also supports the
built-in SQL plugin with the QueryBuilder by converting the combined filter with the subfield back and forth from SQL. 

This plugin lets you work with complex types such as structs or maps with unknown subfields within, allowing you to utilize the QueryBuilder for building queries around them.

## Usage

1. Define your subfield suffix and subfield separators in the QueryBuilder options. The defaults are:
```
fieldSuffixForSubfield: '.*',
fieldSubfieldSeparator: '.'
```

2. Add a ```show_subfield: true``` attribute to the filters that you wish to show a subfield for. 

3. Append your ```fieldSuffixForSubfield``` to each filter's id. This way you can use your filter without the suffix as another filter (since presumably the type of that filter is different from a subfield within it).

When you use ```getRules``` or ```setRules``` or ```getSQL``` or ```setRulesFromSQL```, the subfield will be pulled out or pushed into their respective filters using your ```fieldSubfieldSeparator```.


Code licensed under the Apache 2 license. See LICENSE file for terms.
