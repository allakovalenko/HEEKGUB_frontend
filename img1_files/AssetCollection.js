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
/*global define: true, graphite: true*/

define([
    'backbone',
    '../models/AssetModel'
], function (Backbone, AssetModel) {
    'use strict';
    
    var PATH_SEPARATOR = "/";
    
    var AssetCollection = Backbone.Collection.extend({
        model: AssetModel,

        initialize: function (models, options) {
            this.path = options && options.path;

            if (!this.path) {
                // Backwards compatibility with parfait
                var collectionPath = Backbone.history.fragment || "files";

                collectionPath = collectionPath.slice(-1) === PATH_SEPARATOR ?
                        collectionPath.substring(0, collectionPath.length - 1) : collectionPath;

                this.path = collectionPath;
            } else {
                // TODO cleanup use of Backbone.history.fragment and app router routes
                // Prepend "files/" for consistency in CacheManager
                this.path = "files/" + this.path;
            }
        },

        parse: function (response) {
            var self = this,
                pathMD5Map = {},
                ccPsds = "";
            
            function filterPSDandFolders(asset) {
                // We need only PSD and folders to be rendered for the user
                if (asset.md5) {
                    // test the ending of the path wether it has a trailing slash
                    // Don't create paths with dupe slashes. It breaks the cache.
                    var key = self.path.substr(self.path.length - 1) === PATH_SEPARATOR ?
                            self.path + asset.name :
                            self.path + PATH_SEPARATOR + asset.name;
                    
                    pathMD5Map[key] = asset.md5;
                }
                
                return asset.type === "application/vnd.adobe.directory+json" ||
                    asset.type === "application/x-photoshop" ||
                    asset.type === "image/vnd.adobe.photoshop" ||
                    asset.type === "image/x-photoshop" ||
                    asset.type === "image/photoshop" ||
                    asset.type === "application/psd" ||
                    asset.type === "application/photoshop";
            }
            
            if (response.total_children && response.total_children > 0 && response.children) {
                ccPsds = response.children.filter(filterPSDandFolders);
            }
            
            graphite.events.trigger("cc-directory-load", {
                pathMD5Map: pathMD5Map,
                path: this.path
            });
            
            return ccPsds;
        }

    });
    return AssetCollection;

});
