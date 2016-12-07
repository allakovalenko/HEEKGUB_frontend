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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, bitwise: true */
/*global define: true, graphite: true, Image: true, window: true*/

define([
    'underscore',
    'backbone',
    '../Constants'
], function (_, Backbone, Constants) {
    'use strict';
    var DetailsController = Backbone.Model.extend({

        spriteSheets: {},
        spritesLoaded: {},
        psdModel: null,

        defaults: {
            selectedTab: Constants.Tab.TAB_INSPECT,
            activeTool: Constants.Tool.SELECT_DIRECT,
            selectedInspectItem: null, // color or font selected in inspect tab
            inspectedAsset: null, // asset selected in inspect tab
            toggleMeasurementOnHover: false
        },


        getPSDModel: function () {
            return this.psdModel;
        },


        setPSDModel: function (model) {
            this.psdModel = model;
            // create new sprite sheet map when a new model is set
            this.spriteSheets = {};
            this.spritesLoaded = {};
            this.spriteSheetLoadedEvent = null;

        },


        changeActiveTool: function (toolID) {
            this.set('activeTool', toolID);
        },


        setSelectedTab: function (tab) {
            this.set('selectedTab', tab);
        },

        getSelectedTab: function () {
            return this.get('selectedTab');
        },

        setSelectedInspectItem: function (model) {
            this.set('selectedInspectItem', model);
        },


        setInspectedAsset: function (assetModel) {
            this.set('inspectedAsset', assetModel);
        },

        setToggleMeasurementOnHover: function () {
            this.set('toggleMeasurementOnHover', !this.toggleMeasurementOnHover);
            this.toggleMeasurementOnHover = !this.toggleMeasurementOnHover;
        },

        disableMeasurementOnHover: function () {
            if (this.get('toggleMeasurementOnHover')) {
                this.setToggleMeasurementOnHover();
                graphite.events.trigger('toggle-hover-measurement');
            }
        },

        handleImageLoad: function (image, self, sheetID) {
            self.spritesLoaded[sheetID] = true;
            image.drawWhenFinished.forEach(function (data) {
                data(image);
            });
            if (self.spriteSheetsLoaded()) {
                self.triggerSpriteSheetLoadedEvent();
            }
        },

        drawSpriteSheet: function (sheetID, drawFunc, context) {
            var image = this.spriteSheets[sheetID],
                that = this;
            if (image !== undefined && image !== null) {
                if (this.spritesLoaded[sheetID]) {
                    // Draw sprite sheet
                    drawFunc(image);
                } else {
                    // put this on the list of things to draw
                    image.drawWhenFinished.push(drawFunc);
                }
            } else {
                image = new Image();
                image.drawWhenFinished = [drawFunc];
                this.spriteSheets[sheetID] = image;

                var imgURL = this.getSpriteSheetURL(sheetID);
                image.addEventListener('load', function () {
                    var thatImage = this;
                    that.spritesLoaded[sheetID] = true;
                    this.drawWhenFinished.forEach(function (data) {
                        data(thatImage);
                    });
                    if (that.spriteSheetsLoaded()) {
                        that.triggerSpriteSheetLoadedEvent();
                    }
                }, false);
                this.spritesLoaded[sheetID] = false;
                graphite.getServerAPI().loadCrossDomainImage(image, imgURL);

            }
        },

        getSpriteSheetURL: function (sheetID) {
            var url,
                localContent = this.psdModel.get('localContent');
            if (localContent) {
                url = localContent.directory + '/spritesheet/' + sheetID + '.png';
            } else {
                url = graphite.getServerAPI().getSpriteSheetURL(this.psdModel.id, this.psdModel.get('layerCompId'), sheetID);
            }
            return url;
        },

        triggerWhenSpriteSheetsLoaded: function (eventName) {
            this.spriteSheetLoadedEvent = eventName;
            if (this.spriteSheetsLoaded()) {
                this.triggerSpriteSheetLoadedEvent();
            }
        },

        triggerSpriteSheetLoadedEvent: function (overrideEventName) {
            graphite.events.trigger('hideWorkerProgress', -1);
            var eventName = overrideEventName || this.spriteSheetLoadedEvent;
            this.spriteSheetLoadedEvent = null;
            if (eventName) {
                graphite.events.trigger(eventName, this.psdModel);
            }
        },

        spriteSheetsLoaded: function () {
            var id;
            for (id in this.spriteSheets) {
                if (this.spriteSheets.hasOwnProperty(id)) {
                    if (!this.spriteSheets[id].complete) {
                        return false;
                    }
                }
            }
            return true;
        }

    });

    return new DetailsController();

});
