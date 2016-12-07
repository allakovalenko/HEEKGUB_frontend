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

define([], function () {
    'use strict';
    var Constants = {

        DefaultPPI: 72,

        BaseFontDefaultSize: 16,

        FontUnitType: {
            EMS: 'em',
            REMS: 'rem',
            PX: 'px',
            PT: 'pt'
        },

        ColorFormat: {
            RGB: 'RGB',
            HEX: 'Hex',
            HSL: 'HSL'
        },

        DesignedAtMultiplier: {
            OneX: 1,
            TwoX: 2,
            ThreeX: 3,
            FourX: 4
        },

        MenuPosition: {
            BELOW: '0',
            TOP: '1'
        },

        MeasurementUnitType: {
            PX: 'px',
            PCT: '%'
        },

        PREVIEW_SPACING: 12, //This value must match the variable of the same name in variables.scss

        PREVIEW_SCROLLBAR_SPACING: 17,

        Type: {
            LAYER_ARTBOARD: 'artboardLayer',
            LAYER_GROUP: 'layerSection',
            LAYER: 'layer',
            LAYER_TEXT: 'textLayer',
            LAYER_CONTENT: 'contentLayer',
            LAYER_ADJUSTMENT: 'adjustmentLayer',
            LAYER_BACKGROUND: 'backgroundLayer',
            LAYER_SMARTOBJ: 'smartObject'
        },

        Shape: {
            ELLIPSE: 'ellipse',
            RECTANGLE: 'rectangle',
            PATH: 'path'
        },

        ContentType: {
            SOLID_COLOR: 'solidColorLayer'
        },

        InterceptNames: {
            SHIFT_CLICK_MEASUREMENT: 'shiftClickMeasurement'
        },

        LayerWarnings: {
            MULTI_LAYER_STYLES_WARNING: 'Layer contains multiple layer styles that cannot be represented in CSS. Use the color picker or extract the layer as an image.'
        },

        NotificationTooltip: {
            MIN_DURATION: 3000
        },

        Tool: {
            SELECT_DIRECT: 0,
            DROPPER: 1
        },

        Tab: {
            TAB_INSPECT: 0,
            TAB_LAYERS: 1
        },

        Shortcut: {
            LEFT_ARROW: 37,
            UP_ARROW: 38,
            RIGHT_ARROW: 39,
            DOWN_ARROW: 40,
            HELP: 191,           // /? key
            CLEAR: 27,           // ESC key
            FUX: 73,             // i key
            COLOR_PICKER: 69,    // E key
            ALT: 18,              // ALT Key
            SHIFT: 16,            // Shift
            CTRL: 17,             // Control
            CMD: 91,              // Command
            SECONDARY_CMD: 93,    // Secondary (Right) Command
            CMD_FF: 224,          // Firefox compatible Command
            TOGGLE_MEASUREMENT: 88 // Measurement Key (x key)
        },

        Platform: {
            MAC: 0,
            WINDOWS: 1
        },

        topOffsetWithMessageBar: 70, //offset of psd header when message bar is present
        toolTipTimeout : 2000,//2 seconds
        flashTimeout : 2300, // 2.3 seconds

        CCWEB_FILES_URL: 'https://assets.adobe.com/files',
        CCWEB_FILES_URL_STAGE: 'https://stage.adobecc.com/files',
        RE_SHORT_URL: /^http:\/\/adobe\.ly\/\w+$/,

        WorkerErrorCodes: {
            UNSUPPORTED_INPUTFMT: 'unsupported_input_format_exception',
            NOINPUTFILE: 'no_input_file_exception',
            GRAPHITE_PROCESSING: 'graphite_processing_exception',
            GRAPHITE_REJECTED: 'graphite_file_rejected'
        },

        WorkerErrorMsgs: {
            UNSUPPORTED_INPUTFMT: 'Unsupported Image Format',
            NOINPUTFILE: 'No files specified',
            GR_JSONGENERATION: 'Graphite JSON generation failed.',
            GR_THUMBNAIL: 'Graphite Thumbnail generation failed.',
            GR_SPRITESHEET: 'Graphite Spritesheet generation failed.',
            GR_UNKNOWNENCODING: 'Unspecified Encoding Format',
            GR_MISSINGLAYERSPEC: 'Missing Layer Specification',
            GR_CREATINGASSET: 'Error generating asset'
        }
    };

    return Constants;
});
