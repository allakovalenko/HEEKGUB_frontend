/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Adobe Systems Incorporated and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Adobe Systems Incorporated and its
 * suppliers and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe Systems Incorporated.
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4 */

define(['jquery', 'underscore', '../Constants'], function ($, _, Constants) {
    'use strict';
    var KeyboardUtils = {

        isMultiSelectKey: function (event) {
            var multiSelect = event.shiftKey;
            var os = this.getPlatform();
            if (event.metaKey && os === Constants.Platform.MAC) {   /// this is Mac check for cmd key
                multiSelect = true;
            } else if (event.ctrlKey && os === Constants.Platform.WINDOWS) {
                multiSelect = true;
            }
            return multiSelect;
        },

        getPlatform: function () {
            var osStr = navigator.appVersion.toLowerCase();
            if (osStr.indexOf('macintosh') > -1) {
                osStr = Constants.Platform.MAC;
            } else if (osStr.indexOf('windows') > -1) {
                osStr = Constants.Platform.WINDOWS;
            }
            return osStr;
        },

        getActiveFocusedElement: function () {
            var $activeElement = $(document.activeElement);
            return $activeElement;
        },

        getMetaKeyName: function (name) {
            var keyName = String(name).toLowerCase(),
                platform = this.getPlatform();
            if (keyName === 'ctrl' || keyName === 'cmd') {
                return platform === Constants.Platform.MAC ? '⌘' : 'Ctrl';
            } else if (keyName === 'shift') {
                return platform === Constants.Platform.MAC ? '⇧' : 'Shift';
            } else if (keyName === 'alt' || keyName === 'option') {
                return platform === Constants.Platform.MAC ? '⌥' : 'Alt';
            }
            return name;
        },

        _doesFocusedElementHaveTag: function (tags) {
            var $el = this.getActiveFocusedElement();
            if ($el && $el.length) {
                var isCheck = function (tag) {
                    return $el.is(tag);
                };
                if (_.some(tags, isCheck)) {
                    if (!$el.is('input') && !$el.is('textarea')) {
                        if (!$el[0].isContentEditable) {
                            return null;
                        }
                    }
                    return $el;
                }
            }
            return null;
        },

        isInputInFocus: function () {
            return this._doesFocusedElementHaveTag(['input', 'p', 'div', 'textarea']);
        }

    };

    return KeyboardUtils;
});
