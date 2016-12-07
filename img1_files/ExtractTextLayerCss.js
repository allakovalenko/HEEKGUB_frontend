

define(['underscore','plugin-dependencies','../Constants', '../models/UserSettingsModel', './CSSUtil', './UTF8'  ], 
    function(_, deps, Constants, UserSettingsModel, CSSUtil, UTF8){

    'use strict';

    var FONT_SUB = deps.translate('Approximation due to font substitution');

    var ALIGNMENT = {
        justifyLeft: 'left',
        justifyCenter: 'center',
        justifyRight: 'right',
        justifyFull: 'justify'
    };

    return function (properties, usageModels) {
        var cssArray = [];
        var emittedStyles = [];
        var textRanges = properties.get('textStyleRange');
        var decodedText = UTF8.decodeCharacters(properties.get('rawText'));

        var cssTransform = properties.get('transform') && CSSUtil.getCSSTransform(properties.get('transform'));
        var fontScale = CSSUtil.getTransformedFontScale(properties);
        if (cssTransform && fontScale !== 1) {
            cssTransform.scale(1 / fontScale);
            // transform CSS is emitted at the end of this function
        }

        if (textRanges && textRanges.length > 0) {
            var inlineEmitted = false;

            var isDupFunc = function (style) {
                return _.isEqual(textStyle, style);
            };

            for (var i = 0; i < textRanges.length; i++) {
                var textStyle = textRanges[i].textStyle;
                var paragraphStyle = textRanges[i].paragraphStyle;
                var textFragment = decodedText.substring(textRanges[i].from, textRanges[i].to);

                // Only emit if we haven't already done so. We are only
                // interesting in highlighting unique style combinations.
                var isDup = _.some(emittedStyles, isDupFunc);

                if (textFragment.trim() !== "" && !isDup) {
                    if (i >= 1) {
                        cssArray.push({
                            spacer: true,
                            label: '/* ' + deps.translate('Inline Style') + ' */',
                            property: null,
                            value: null
                        });
                        inlineEmitted = true;
                    }

                    var fontInfo = CSSUtil.getFontInfo(textStyle);
                    cssArray.push({
                        property: 'font-family',
                        value: CSSUtil.formatCSSValue('font-family', fontInfo.fontName)
                    });

                    // Color
                    var color;
                    var blendOptions = properties.get('blendOptions');

                    if (usageModels.colorUsageModels.length === 1) {
                        color = usageModels.colorUsageModels[0].get('style');
                        color = {
                            red: color.get('red'),
                            green: color.get('green'),
                            blue: color.get('blue'),
                            alpha: color.get('alpha')
                        };
                    } else {
                        color = textStyle.color;
                    }
                    if (blendOptions && blendOptions.hasOwnProperty('fillOpacity')) {
                        color.alpha *= blendOptions.fillOpacity / 100;
                    }
                    cssArray.push({
                        property: 'color',
                        value: CSSUtil.getDefaultColorString(color.red, color.green, color.blue, color.alpha)
                    });

                    // Font size
                    var fontSize = CSSUtil.parseCSSMeasure(fontInfo.size);
                    // round to 2 decimal places. This is what Photoshop does,
                    // even when you manually enter more.
                    fontSize.val = Math.round(fontSize.val * fontScale * 100) / 100;
                    var fontSizePx = CSSUtil.convertUnits(fontSize, Constants.FontUnitType.PX);
                    cssArray.push({
                        property: 'font-size',
                        value: CSSUtil.convertPSDUnitsToPreferredUnits(fontSize, true),
                        comment: fontInfo.coolTypeResolved ? undefined : FONT_SUB
                    });

                    // Font weight and style
                    if (fontInfo.fontFace) {
                        cssArray = cssArray.concat(CSSUtil.fontStyleNameToCSS(fontInfo.fontFace));
                    }

                    // Tracking/letter-spacing
                    var tracking;
                    if (textStyle.tracking && (tracking = parseInt(textStyle.tracking, 10)) !== 0) {
                        // Photoshop tracking units are 1/1000 of an em, (see
                        // http://en.wikipedia.org/wiki/Letter-spacing#Varying_applications )
                        // so divide by 1000 to convert to ems
                        var trackingEms = tracking / 1000;
                        cssArray.push({
                            property: 'letter-spacing',
                            value: CSSUtil.convertPSDUnitsToPreferredUnits({
                                val: trackingEms,
                                units: Constants.FontUnitType.EMS
                            }, true, fontSizePx),
                            comment: fontInfo.coolTypeResolved ? undefined : FONT_SUB
                        });
                    }

                    // Leading
                    if (textStyle.leading) {
                        var leading = CSSUtil.parseCSSMeasure(textStyle.leading);
                        var units = UserSettingsModel.get('preferredFontUnits'),
                            value;
                        if (units === Constants.FontUnitType.PX) {
                            value = +(+leading.val).toFixed(3) + units;
                        } else {
                            value = +(leading.val / fontSize.val).toFixed(3);
                        }
                        cssArray.push({
                            property: 'line-height',
                            value: value,
                            comment: fontInfo.coolTypeResolved ? undefined : FONT_SUB
                        });
                    }

                    // Text-decoration
                    if (textStyle.underline === 'underlineOn') {
                        cssArray.push({
                            property: 'text-decoration',
                            value: 'underline'
                        });
                    }

                    // Text align
                    if (ALIGNMENT.hasOwnProperty(paragraphStyle.textJustification)) {
                        cssArray.push({
                            property: 'text-align',
                            value: ALIGNMENT[paragraphStyle.textJustification]
                        });
                    }

                    // Text indent
                    if (paragraphStyle.firstLineIndent && parseInt(paragraphStyle.firstLineIndent, 10) !== 0) {
                        cssArray.push({
                            property: 'text-indent',
                            value: CSSUtil.convertPSDUnitsToPreferredUnits(paragraphStyle.firstLineIndent, true, fontSizePx)
                        });
                    }

                    // Drop shadow
                    if (properties.get('dropShadow')) {
                        cssArray.push({
                            property: 'text-shadow',
                            value: properties.get('dropShadow')
                        });
                    }
                    emittedStyles.push(textStyle);
                }
            }

            if (cssTransform && cssTransform.toString() !== '') {
                cssArray.push({
                    property: 'transform',
                    value: cssTransform.toString()
                });
            }

            // Insert separator before additional CSS.
            if (inlineEmitted) {
                cssArray.push({
                    spacer: true,
                    label: ''
                });
            }
        }

        return cssArray;
    };
});
