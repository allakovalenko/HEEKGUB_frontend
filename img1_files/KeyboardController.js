/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
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
/*global graphite*/

define([
    'jquery',
    'underscore',
    './SelectionController',
    '../Constants',
    '../utils/KeyboardUtils'
], function ($, _, SelectionController, Constants, KeyboardUtils) {
    'use strict';

    var KeyboardController = {
        attachedElement: null,
        multiSelectPending: false,

        // attach key handlers to the passed in $element, replacing any previously passed in $element.
        // if no element is passed in, then use document.
        attachKeyHandlers: function ($element) {
            if (this.attachedElement) {
                this.removeKeyHandlers();
            }
            _.bindAll(this, 'handleKeyUp', 'handleKeyDown');
            this.attachedElement = $element || $(document);
            this.attachedElement.keyup(this.handleKeyUp);
            this.attachedElement.keydown(this.handleKeyDown);
        },

        removeKeyHandlers: function () {
            if (this.attachedElement) {
                this.attachedElement.unbind('keyup', this.handleKeyUp);
                this.attachedElement.unbind('keydown', this.handleKeyDown);
                this.attachedElement = null;
            }
        },

        isMultiSelectModifier: function (e) {
            var result = KeyboardUtils.isMultiSelectKey(e);

            // Also make sure that the modifier is the only key pressed.
            if (result) {
                result = _.contains([
                    Constants.Shortcut.SHIFT,
                    Constants.Shortcut.CTRL,
                    Constants.Shortcut.CMD,
                    Constants.Shortcut.SECONDARY_CMD,
                    Constants.Shortcut.CMD_FF
                ], e.keyCode);
            }

            return result;
        },

        setMultiSelectPending: function (value) {
            if (this.multiSelectPending !== value) {
                graphite.events.trigger('multiSelectPending', value);
                this.multiSelectPending = value;
            }
        },

        handleKeyDown: function (e) {
            // This is needed for Brackets and Dreamweaver integration, so that
            // we don't handle their key events
            if (!this._hasFocus()) {
                return;
            }

            this.setMultiSelectPending(this.isMultiSelectModifier(e));

            switch (e.keyCode) {
            case Constants.Shortcut.LEFT_ARROW:
            case Constants.Shortcut.RIGHT_ARROW:
            case Constants.Shortcut.UP_ARROW:
            case Constants.Shortcut.DOWN_ARROW:
                if (this.handleArrowKeys) {
                    if (SelectionController.getSelectedLayers().length !== 0) {
                        e.stopPropagation();
                        e.preventDefault();
                    }
                }
                break;
            }
        },

        _hasFocus: function () {
            return document.activeElement === this.attachedElement[0] ||
                !KeyboardUtils.isInputInFocus();
        },

        handleKeyUp: function (e) {
            // This is needed for Brackets and Dreamweaver integration, so that
            // we don't handle their key events
            if (!this._hasFocus()) {
                return;
            }

            this.setMultiSelectPending(false);

            switch (e.keyCode) {
            case Constants.Shortcut.CLEAR:
                graphite.events.trigger('dismiss-modal-views');
                graphite.events.trigger('hide-first-user-overlay');
                SelectionController.disableDropperTool();
                SelectionController.selectItemAtPoint(-1, -1, false);
                graphite.getDetailsController().setSelectedInspectItem(null);
                break;
            case Constants.Shortcut.LEFT_ARROW:
                SelectionController.selectParent();
                break;
            case Constants.Shortcut.RIGHT_ARROW:
                SelectionController.selectTopChild();
                break;
            case Constants.Shortcut.UP_ARROW:
                SelectionController.selectPrevSibling();
                break;
            case Constants.Shortcut.DOWN_ARROW:
                SelectionController.selectNextSibling();
                break;
            case Constants.Shortcut.TOGGLE_MEASUREMENT:
                if (graphite.getDetailsController().get('activeTool') === Constants.Tool.DROPPER) {
                    SelectionController.disableDropperTool();
                }
                graphite.getDetailsController().setToggleMeasurementOnHover();
                graphite.events.trigger('toggle-hover-measurement');
                break;
            case Constants.Shortcut.HELP:
                graphite.events.trigger('toggle-help-dialog', {from: 'keyboard'});
                break;
            case Constants.Shortcut.COLOR_PICKER:
                graphite.getDetailsController().disableMeasurementOnHover();
                if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
                    SelectionController.enableDropperTool();
                }
                break;
            case Constants.Shortcut.FUX:
                graphite.events.trigger('toggle-first-user-overlay', {from: 'keyboard'});
                // If FUX gets added back, check for `params.from === 'keyboard'`
                // in the event handler and and trigger this event:
                // graphite.events.trigger('first-user-overlay-shortcut');
                break;
            }
        }
    };

    return KeyboardController;
});
