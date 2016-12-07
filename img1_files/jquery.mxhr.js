/*
 * This file contains code derived from two different open-source libraries under different licenses,
 * plus modifications by Adobe to add functionality, wrap as a Require module, and glue the two libs
 * together.
 * 
 * 
 * Code from multipart_parser.js (https://github.com/felixge/node-formidable/blob/master/lib/multipart_parser.js):
 * 
 * Copyright (C) 2011 Felix Geisendörfer
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 * 
 * 
 * Code from jquery.mxhr.js (https://github.com/dfltr/jQuery-MXHR):
 * 
 * Copyright 2011 Micah Snyder <micah.snyder@gmail.com>. All rights reserved.
 * Redistribution and use in source and binary forms, with or without modification, are
 * permitted provided that the following conditions are met:
 *    1. Redistributions of source code must retain the above copyright notice, this list of
 *       conditions and the following disclaimer.
 *    2. Redistributions in binary form must reproduce the above copyright notice, this list
 *       of conditions and the following disclaimer in the documentation and/or other materials
 *       provided with the distribution.
 * THIS SOFTWARE IS PROVIDED BY MICAH SNYDER "AS IS" AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 * FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, bitwise: true, es5: true */
/*global define, XMLHttpRequest, Uint8Array */

(function ($) {
    "use strict";
    $.multipart = function (options) {
        
        function Part() {
            this.headers  = {};
            this.header = '';
            this.body = null;
        }
    
        var s = 0,
            S = {
                PARSER_UNINITIALIZED: s++,
                START: s++,
                START_BOUNDARY: s++,
                HEADER_FIELD_START: s++,
                HEADER_FIELD: s++,
                HEADER_VALUE_START: s++,
                HEADER_VALUE: s++,
                HEADER_VALUE_ALMOST_DONE: s++,
                HEADERS_ALMOST_DONE: s++,
                PART_DATA_START: s++,
                PART_DATA: s++,
                PART_END: s++,
                END: s++
            },

            f = 1,
            F = {
                PART_BOUNDARY: f,
                LAST_BOUNDARY: f *= 2
            },

            LF = 10,
            CR = 13,
            SPACE = 32,
            HYPHEN = 45,
            COLON = 58,
            A = 97,
            Z = 122,

            lower = function (c) {
                return c | 0x20;
            };

        function MultipartParser() {
            this.boundary = null;
            this.boundaryChars = null;
            this.lookbehind = null;
            this.state = S.PARSER_UNINITIALIZED;
            
            this.index = null;
            this.flags = 0;
            this._part   = new Part();
        }
        
        MultipartParser.prototype.Uint8Concat = function (first, second) {
            var firstLength = first.length,
                result = new Uint8Array(firstLength + second.length);
        
            result.set(first);
            result.set(second, firstLength);
        
            return result;
        };
                
        MultipartParser.prototype.unpackString = function (str) {
            var buffer = new Uint8Array(str.length),
                length = str.length,
                i = 0;
            
            for (i = 0; i < length; i++) {
                if (str.charCodeAt(i)) {
                    buffer[i] = str.charCodeAt(i);
                }
            }
            
            return buffer;
        };
        
        MultipartParser.prototype.initWithBoundary = function (str) {
            var  i = 0;
            this.boundary =  new Uint8Array(str.length + 4);
            this.boundary = this.unpackString('\r\n' + str);
            this.lookbehind =  new Uint8Array(this.boundary.length + 8);
            this.state = S.START;
            
            this.boundaryChars = {};
            for (i = 0; i < this.boundary.length; i++) {
                this.boundaryChars[this.boundary[i]] = true;
            }
        };
        
        MultipartParser.prototype.write = function (dataBuffer) {
            var self = this,
                buffer = new Uint8Array(dataBuffer),
                i = 0,
                len = buffer.length,
                prevIndex = this.index,
                index = this.index,
                state = this.state,
                flags = this.flags,
                lookbehind = this.lookbehind,
                boundary = this.boundary,
                boundaryChars = this.boundaryChars,
                boundaryLength = this.boundary.length,
                boundaryEnd = boundaryLength - 1,
                bufferLength = buffer.length,
                c,
                cl,
        
                mark = function (name) {
                    self[name + 'Mark'] = i;
                },
                
                clear = function (name) {
                    delete self[name + 'Mark'];
                },
                
                callback = function (name, buffer, start, end) {
                    if (start !== undefined && start === end) {
                        return;
                    }
                    
                    var callbackSymbol = 'on' + name.substr(0, 1).toUpperCase() + name.substr(1);
                    if (callbackSymbol in self) {
                        self[callbackSymbol](buffer, start, end);
                    }
                },
                
                dataCallback = function (name, clear) {
                    var markSymbol = name + 'Mark';
                    if (!(markSymbol in self)) {
                        return;
                    }
                    
                    if (!clear) {
                        callback(name, buffer, self[markSymbol], buffer.length);
                        self[markSymbol] = 0;
                    } else {
                        callback(name, buffer, self[markSymbol], i);
                        delete self[markSymbol];
                    }
                };
        
            for (i = 0; i < len; i++) {
                c = buffer[i];
                switch (state) {
                case S.PARSER_UNINITIALIZED:
                    return i;
                        
                case S.START:
                    index = 0;
                    state = S.START_BOUNDARY;
                        
                case S.START_BOUNDARY:
                    if (index === boundary.length - 2) {
                        if (c === HYPHEN) {
                            flags |= F.LAST_BOUNDARY;
                        } else if (c !== CR) {
                            return i;
                        }
                        index++;
                        break;
                    } else if (index - 1 === boundary.length - 2) {
                        if (flags & F.LAST_BOUNDARY && c === HYPHEN) {
                            callback('end');
                            state = S.END;
                            flags = 0;
                        } else if (!(flags & F.LAST_BOUNDARY) && c === LF) {
                            index = 0;
                            callback('partBegin');
                            state = S.HEADER_FIELD_START;
                        } else {
                            return i;
                        }
                        break;
                    }
                
                    if (c !== boundary[index + 2]) {
                        index = -2;
                    }
                    if (c === boundary[index + 2]) {
                        index++;
                    }
                    break;

                case S.HEADER_FIELD_START:
                    state = S.HEADER_FIELD;
                    mark('headerField');
                    index = 0;
                
                case S.HEADER_FIELD:
                    if (c === CR) {
                        clear('headerField');
                        state = S.HEADERS_ALMOST_DONE;
                        break;
                    }
                
                    index++;
                    if (c === HYPHEN) {
                        break;
                    }
                
                    if (c === COLON) {
                        if (index === 1) {
                            // empty header field
                            return i;
                        }
                        dataCallback('headerField', true);
                        state = S.HEADER_VALUE_START;
                        break;
                    }
                    
                    cl = lower(c);
                    if (cl < A || cl > Z) {
                        return i;
                    }
                    break;
                        
                case S.HEADER_VALUE_START:
                    if (c === SPACE) {
                        break;
                    }
                
                    mark('headerValue');
                    state = S.HEADER_VALUE;
                
                case S.HEADER_VALUE:
                    if (c === CR) {
                        dataCallback('headerValue', true);
                        callback('headerEnd');
                        state = S.HEADER_VALUE_ALMOST_DONE;
                    }
                    break;
                
                case S.HEADER_VALUE_ALMOST_DONE:
                    if (c !== LF) {
                        return i;
                    }
                    state = S.HEADER_FIELD_START;
                    break;
                
                case S.HEADERS_ALMOST_DONE:
                    if (c !== LF) {
                        return i;
                    }
                
                    callback('headersEnd');
                    state = S.PART_DATA_START;
                    break;
                
                case S.PART_DATA_START:
                    state = S.PART_DATA;
                    mark('partData');
                
                case S.PART_DATA:
                    prevIndex = index;
                
                    if (index === 0) {
                      // boyer-moore derrived algorithm to safely skip non-boundary data
                        i += boundaryEnd;
                        while (i < bufferLength && !(buffer[i] in boundaryChars)) {
                            i += boundaryLength;
                        }
                        i -= boundaryEnd;
                        c = buffer[i];
                    }
                
                    if (index < boundary.length) {
                        if (boundary[index] === c) {
                            if (index === 0) {
                                dataCallback('partData', true);
                            }
                            index++;
                        } else {
                            index = 0;
                        }
                    } else if (index === boundary.length) {
                        index++;
                        if (c === CR) {
                            // CR = part boundary
                            flags |= F.PART_BOUNDARY;
                        } else if (c === HYPHEN) {
                            // HYPHEN = end boundary
                            flags |= F.LAST_BOUNDARY;
                        } else {
                            index = 0;
                        }
                    } else if (index - 1 === boundary.length) {
                        if (flags & F.PART_BOUNDARY) {
                            index = 0;
                            if (c === LF) {
                                // unset the PART_BOUNDARY flag
                                flags &= ~F.PART_BOUNDARY;
                                callback('partEnd');
                                callback('partBegin');
                                state = S.HEADER_FIELD_START;
                                break;
                            }
                        } else if (flags & F.LAST_BOUNDARY) {
                            if (c === HYPHEN) {
                                callback('partEnd');
                                callback('end');
                                state = S.END;
                                flags = 0;
                            } else {
                                index = 0;
                            }
                        } else {
                            index = 0;
                        }
                    }
                
                    if (index > 0) {
                        // when matching a possible boundary, keep a lookbehind reference
                        // in case it turns out to be a false lead
                        lookbehind[index - 1] = c;
                    } else if (prevIndex > 0) {
                        // if our boundary turned out to be rubbish, the captured lookbehind
                        // belongs to partData
                        callback('partData', lookbehind, 0, prevIndex);
                        prevIndex = 0;
                        mark('partData');
                
                        // reconsider the current character even so it interrupted the sequence
                        // it could be the beginning of a new sequence
                        i--;
                    }
                
                    break;
                
                case S.END:
                    break;
                
                default:
                    return i;
                }
            }
                
            dataCallback('headerField');
            dataCallback('headerValue');
            dataCallback('partData');
                
            this.index = index;
            this.state = state;
            this.flags = flags;
                
            return len;
        };

        MultipartParser.prototype.onHeaderField = function (buffer, start, end) {
            var data = String.fromCharCode.apply(null, buffer.subarray(start, end));
            this._part.header = data;
        };
        
        MultipartParser.prototype.onHeaderValue = function (buffer, start, end) {
            this._part.headers[this._part.header] = String.fromCharCode.apply(null, buffer.subarray(start, end));
        };
        
        MultipartParser.prototype.onPartData = function (buffer, start, end) {
            var data = buffer.subarray(start, end),
                mime = this._part.headers['Content-Type'];
            
            if (this._part.body) {
                this._part.body = this.Uint8Concat(this._part.body, buffer.subarray(start, end));
            } else {
                this._part.body = buffer.subarray(start, end);
            }
        };

        MultipartParser.prototype.onPartEnd = function () {
            var  mime = this._part.headers['Content-Type'];
            
            if (options[mime] && this._part.body) {
                options[mime].call(this._part.body, this._part.headers['Content-ID']);
                this._part.body = null;
                this._part.headers = {};
                this._part.header = '';
            }
        };
        
        MultipartParser.prototype.onEnd = function () {
            if (options.hasOwnProperty('onSuccess')) {
                options.onSuccess.call(this);
            }
        };
        
        MultipartParser.prototype.end = function () {
            var callback = function (self, name) {
                var callbackSymbol = 'on' + name.substr(0, 1).toUpperCase() + name.substr(1);
                if (callbackSymbol in self) {
                    self[callbackSymbol]();
                }
            };
            if ((this.state === S.HEADER_FIELD_START && this.index === 0) ||
                    (this.state === S.PART_DATA && this.index === this.boundary.length)) {
                callback(this, 'partEnd');
                callback(this, 'end');
            } else if (this.state !== S.END) {
                return new Error('MultipartParser.end(): stream ended unexpectedly: ' + this.state);
            }
        };

        
        var url = options.url,
            req,
            boundary,
            type = options.type || 'GET',
            data = options.data || false,
            csrfToken = $("meta[name='csrf-token']").attr("content"),
            headers = options.headers;

        var readyStateNanny = function () {
            if (req.readyState === 3) {
                var contentTypeHeader = req.getResponseHeader("Content-Type");

                //No HTTP error, just a bad response
                if (contentTypeHeader.indexOf("multipart") === -1) {
                    req.onreadystatechange = function () {
                        req.onreadystatechange = function () {};
                        if (options.hasOwnProperty('onError')) {
                            options.onError.call(req.status);
                        } 
                    };

                } else {
                    boundary = '--' + /boundary=([^\x3B]+)/.exec(contentTypeHeader)[1];
                }
            }

            if(req.readyState === 4 && req.status === 200) {
                var response = req.response;
                var parser = new MultipartParser();
                parser.initWithBoundary(boundary);
                parser.write(response);
            } else if (req.readyState === 4 && req.status !== 200) {
                if (options.hasOwnProperty('onError')) {
                    options.onError.call(req.status);
                }                
            }
        };
        
        //These versions of XHR are known to work with MXHR
        try { req = new ActiveXObject('MSXML2.XMLHTTP.6.0'); } catch(nope) {
            try { req = new ActiveXObject('MSXML3.XMLHTTP'); } catch(nuhuh) {
                try { req = new XMLHttpRequest(); } catch(noway) {
                    throw new Error('Could not find supported version of XMLHttpRequest.');
                }
            }
        }
        
        req.responseType = 'arraybuffer';
        req.open(type, url, true);
        req.onreadystatechange = readyStateNanny;

        if(csrfToken) {
            req.setRequestHeader("X-CSRF-Token", csrfToken);
        }
        if(headers) {
            $.each( headers, function( key, value ) {
                req.setRequestHeader(key, value);
            });
        }
    
        req.send(data ? data : null);
    };
})(jQuery);
