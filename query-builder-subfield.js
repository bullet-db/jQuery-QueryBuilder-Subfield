/*
 *  Copyright 2016, Yahoo Inc.
 *  Licensed under the terms of the Apache License, Version 2.0.
 *  See the LICENSE file associated with the project for terms.
 */

/*
 * jQuery QueryBuilder Subfield
 * This plugin lets you define a free form field in addition to choosing a filter operator. It also
 * works with the SQLPlugin.
 */
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['jquery', 'query-builder'], factory);
    }
    else {
        factory(root.jQuery);
    }
}(this, function($) {
    "use strict";

    var QueryBuilder = $.fn.queryBuilder;
    QueryBuilder.prototype = $.fn.queryBuilder.constructor.prototype;
    QueryBuilder.Rule = $.fn.queryBuilder.constructor.Rule;
    QueryBuilder.templates = $.fn.queryBuilder.constructor.templates;
    QueryBuilder.selectors = $.fn.queryBuilder.constructor.selectors;

    // Unfortunately, the events system is not sufficient. Need to override these methods to implement adding a new text field.
    var originalUpdateRuleFilter = QueryBuilder.prototype.updateRuleFilter;

    var originalUpdateRuleOperator = QueryBuilder.prototype.updateRuleOperator;

    var originalGetRules = QueryBuilder.prototype.getRules;

    var originalSetRules = QueryBuilder.prototype.setRules;

    var originalAddRule = QueryBuilder.prototype.addRule;

    var SubfieldSelectors = {
        subfield_container: '.rule-subfield-container',
        rule_subfield:      '.rule-subfield-container [name$=_subfield]'
    };


    QueryBuilder.defaults({

        fieldSubfieldSeparator: '.',

        fieldSuffixForSubfield: '.*',

        subfield_template: {
            subfieldInput: null
        }
    });

    /*
     * Derived from defineModelProperties
     */
    function defineModelSubfieldProperty(obj, fields) {
        fields.forEach(function(field) {
            Object.defineProperty(obj.prototype, field, {
                enumerable: true,
                get: function() {
                    return this.__[field];
                },
                set: function(value) {
                    var oldValue = (this.__[field] !== null && typeof this.__[field] == 'object') ?
                      $.extend({}, this.__[field]) :
                      this.__[field];

                    this.__[field] = value;

                    if (this.model !== null) {
                        this.model.trigger('updateSubfield', this, field, value, oldValue);
                    }
                }
            });
        });
    }

    /**
     * Add a subfield property to the Rule defined in QueryBuilder
     */
    defineModelSubfieldProperty(QueryBuilder.Rule, ['subfield']);

    QueryBuilder.templates.subfieldInput = '\
    <input class="form-control" name="{{= it.rule.id }}_subfield" placeholder="subfield"> \
    </input>';


    QueryBuilder.define('subfield', function() {
        var that = this;

        this.on('afterInit', function() {
            that.subfield_template = that.settings.subfield_template;
            // add subfield template
            Object.keys(that.subfield_template).forEach(function(tpl) {
                if (!that.templates[tpl]) {
                    that.templates[tpl] = QueryBuilder.templates[tpl];
                }
                if (typeof that.templates[tpl] == 'string') {
                    that.templates[tpl] = doT.template(that.templates[tpl]);
                }
            }, that);
            // bind update subfield event
            that.bindSubfieldEvent();
        });

        this.on('getRuleTemplate.filter', function(h) {
            var $h = $(h.value);
            $h.find(QueryBuilder.selectors.operator_container).before('<div class="rule-subfield-container"></div>');
            h.value = $h.prop('outerHTML');
        });

        this.on('getSQLField.queryBuilder.filter', function(e, rule) {
            if (rule.subfield) {
                // Remove the suffix from the field and add on the subfield separator
                var oldfield = e.value;
                e.value = oldfield.substring(0, oldfield.lastIndexOf(that.settings.fieldSuffixForSubfield)) + that.settings.fieldSubfieldSeparator + rule.subfield;
            }
        });

        this.on('sqlToRule.queryBuilder.filter', function(e) {
            var rule = e.value;
            if (rule.field) {
                var split_field = rule.field.split(that.settings.fieldSubfieldSeparator);
                var length = split_field.length;
                if (length >= 2) {
                    // Search the filters to make sure this field doesn't exist exactly. If so, don't subfield it
                    var filter = e.builder.filters.find(function(filter) {
                        return filter.id === rule.field;
                    });
                    if (!filter) {
                        rule.field = split_field.slice(0, -1).join(that.settings.fieldSubfieldSeparator);
                        rule.subfield = split_field[length - 1];
                    }
                }
            }
            e.value = rule;
        });

    });

    QueryBuilder.extend({
        bindSubfieldEvent : function() {
            var that = this;
            // model events
            this.model.on({
                'updateSubfield': function(e, node, field, value, oldValue) {
                    if (node instanceof QueryBuilder.Rule) {
                        switch (field) {
                            case 'error':
                                that.displayError(node);
                                break;
                            case 'subfield':
                                that.updateRuleSubfield(node);
                                break;
                        }
                    }
                    else {
                        switch (field) {
                            case 'error':
                                that.displayError(node);
                                break;

                            case 'flags':
                                that.applyGroupFlags(node);
                                break;

                            case 'condition':
                                that.updateGroupCondition(node);
                                break;
                        }
                    }
                }
            });
        },

        getSubfieldInput : function(rule) {
            var h = this.templates.subfieldInput({
                builder: this,
                rule: rule
            });
            return this.change('getSubfieldInput', h, rule);
        },

        createRuleSubfield : function(rule) {
            var $subfieldContainer = rule.$el.find(SubfieldSelectors.subfield_container);
            $subfieldContainer.empty();
            rule.__.subfield = undefined;

            if (!rule.filter.show_subfield) {
                return;
            }

            var $subfieldInput = $(this.getSubfieldInput(rule));
            $subfieldContainer.html($subfieldInput);
            var that = this, filter = rule.filter;
            $subfieldInput.on('change ' + (filter.input_event || ''), function() {
                that.status.updating_subfield = true;
                rule.subfield = that.getRuleSubfield(rule);
                that.status.updating_subfield = false;
            });

            this.trigger('afterCreateRuleSubfield', rule);

            that.status.updating_subfield = true;
            rule.subfield = that.getRuleSubfield(rule);
            that.status.updating_subfield = false;
        },

        getRuleSubfield : function(rule) {
            var filter = rule.filter,
            operator = rule.operator,

            value = [];
            var $value = rule.$el.find(SubfieldSelectors.subfield_container);
            var name = rule.id + '_subfield';
            value.push($value.find('[name='+ name +']').val());

            return this.change('getRuleSubfield', value, rule);
        },

        setRuleSubfield : function(rule, value) {
            var $value = rule.$el.find(SubfieldSelectors.subfield_container);
            var name = rule.id +'_subfield';
            $value.find('[name='+ name +']').val(value).trigger('change');
        },

        updateRuleSubfield : function(rule) {
            if (!this.status.updating_subfield) {
                this.setRuleSubfield(rule, rule.subfield);
            }
            this.trigger('afterUpdateRuleSubfield', rule);
        },

        /*
         * Extend original updateRuleFilter
         */
        updateRuleFilter : function(rule) {
            this.createRuleSubfield(rule);
            originalUpdateRuleFilter.call(this, rule);
        },

        /*
         * Extend original updateRuleOperator
         */
        updateRuleOperator : function(rule, previousOperator) {
            var previousOperatorOverride = {};
            previousOperatorOverride.nb_inputs = -1;
            originalUpdateRuleOperator.call(this, rule, previousOperatorOverride);
        },

        // ----------- For getting rules --------------------------
        preSetSubfieldFromDataForRule: function(rule) {
            if (rule.subfield) {
                if (!rule.data) {
                    rule.data = {};
                }
                rule.data.subfield = rule.subfield;
            } else {
                if (rule.data && rule.data.subfield) {
                    delete rule.data.subfield;
                }
            }
        },


        preSetSubfieldFromDataForGroup: function(group) {
            var that = this;
            group.each(
                function(rule) {
                    that.preSetSubfieldFromDataForRule(rule);
                },
                function(group) {
                    that.preSetSubfieldFromDataForGroup(group);
                }
            );
        },

        postSetSubfieldFromData : function(data) {
            var that = this;
            if (data.rules && data.rules.length > 0) {
                data.rules.forEach(function(item) {
                    that.postSetSubfieldFromData(item);
                });
            } else {
                var rule = data;
                if (rule.data && rule.data.subfield) {
                    rule.subfield = rule.data.subfield;
                    delete rule.data.subfield;
                }
            }
        },

        /*
         * Extend the original getRules
         */
        getRules : function(options) {
            this.preSetSubfieldFromDataForGroup(this.model.root);
            var data = originalGetRules.call(this, options);
            this.postSetSubfieldFromData(data);
            return data;
        },

        // ------------ For setting rules ----------------------
        preSetSubfieldToData : function(data) {
            var that = this;
            if (data.rules && data.rules.length > 0) {
                data.rules.forEach(function(item) {
                    that.preSetSubfieldToData(item);
                });
            } else {
                var rule = data;
                if (rule.subfield) {
                    if (!rule.data) {
                        rule.data = {};
                    }
                    rule.data.subfield = rule.subfield;
                }
            }
        },

        postSetSubfieldToDataForRule : function(rule) {
            if (rule.data && rule.data.subfield) {
                var subfieldTmp = [];
                subfieldTmp.push(rule.data.subfield);
                rule.subfield = subfieldTmp;
            }
        },

        postSetSubfieldToDataForGroup: function(group) {
            var that = this;
            group.each(
                function(rule) {
                    that.postSetSubfieldToDataForRule(rule);
                },
                function(group) {
                    that.postSetSubfieldToDataForGroup(group);
                }
            );
        },

        /*
         * Extend the original setRules
         */
        setRules : function(data) {
            // Add the subfield information to the data object
            this.preSetSubfieldToData(data);
            originalSetRules.call(this, data);
            // Add the subfield information from the data objects to the model
            this.postSetSubfieldToDataForGroup(this.model.root);
        },
    });
}));
