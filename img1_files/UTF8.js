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

define([ ], function () {
    'use strict';

    var UTF8 = {
        decodeCharacters: function (utftext) {
            utftext = utftext || '';
            var iterator = {
                    text: utftext,
                    index: 0,
                    nextChar: function () {
                        var c = null;
                        if (this.index < this.text.length) {
                            c = this.text.charCodeAt(this.index);
                            if (c === 65535) {
                                c = parseInt(this.text.substr(this.index + 3, 2), 16);
                                this.index = this.index + 4;
                            }
                            this.index = this.index + 1;
                        }
                        return c;
                    },
                    atEnd: function () {
                        return this.index >= this.text.length;
                    }
                },
                string = '',
                c,
                c1,
                c2;

            while (!iterator.atEnd()) {
                c = iterator.nextChar();
                if (c < 128) {
                    string += String.fromCharCode(c);
                } else if ((c > 191) && (c < 224)) {
                    c1 = iterator.nextChar();
                    string += String.fromCharCode(((c & 31) << 6) | (c1 & 63));
                } else {
                    c1 = iterator.nextChar();
                    c2 = iterator.nextChar();
                    string += String.fromCharCode(((c & 15) << 12) | ((c1 & 63) << 6) | (c2 & 63));
                }
            }
            return string;
        }
    };

    return UTF8;
});
