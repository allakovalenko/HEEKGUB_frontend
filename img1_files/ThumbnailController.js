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
/*global define: true, graphite: true, Image: true*/

define([
    'backbone',
    '../Constants'
], function (Backbone, Constants) {
    "use strict";
    //debugger;
    //var Constants = graphite.getConstants();
    var ThumbnailController = {
        drawThumbnail: function (model, htmlElem) {
            var assetID = model.get("id"),
                md5 = model.get("md5"),
                image = this[assetID],
                self = this;

            if (image && image.image.complete && image.md5 === md5) {
                this.makeDrawFunc(image.image, htmlElem)();
            } else {
                image = {
                    md5 : md5,
                    image: new Image()
                };

                if (model.get('type') === "application/vnd.adobe.directory+json") {
                    image.image.addEventListener("load", self.makeDrawFunc(image.image, htmlElem));
                    self[assetID] = image;
                } else {
                    var pathSeparator  = '/',
                        ccpath = decodeURI(Backbone.history.fragment) || "files",
                        ccAssetID = model.get("id"),
                        name = model.get("name"),
                        storagePath,
                        size = Constants.ThumbnailWidth,
                        height = model.get("height"),
                        width = model.get("width");

                    if (width < height) {
                        size = Math.round(height / width * size);
                    }
                    
                    // The upload tile's model doesn't have a name. Do not fetch thumbnail in this case.
                    if (name) {
                        storagePath = ccpath + pathSeparator + name;

                        graphite.getServerAPI().getRendition(storagePath, size, function (err, imgurl) {
                            if (imgurl) {
                                image.image.addEventListener("load", self.makeDrawFunc(image.image, htmlElem));
                                image.image.src = imgurl;
                                self[ccAssetID] = image;
                            }
                        });
                    }
                }
            }
        },

        makeDrawFunc: function (image, htmlElem) {
            var theImage = image,
                theElem = htmlElem;

            return function () {
                theElem.width = image.width;
                theElem.height = image.height;
                var context = theElem.getContext('2d');
                context.drawImage(theImage, 0, 0);
            };
        }
    };

    return ThumbnailController;
});
