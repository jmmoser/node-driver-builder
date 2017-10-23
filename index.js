'use strict';

const fs = require('fs');
const Drivers = require('node-drivers');

const INTERPOLATION_TYPES = {
  'linear': 1
};

class Driver {
  constructor(config) {
    if (typeof config === 'string') {
      config = require(config);
    }

    this.__setup(config);
  }

  __setup(config) {
    this.__setupConnection(config);
    this.__setupTags(config);
  }

  __setupConnection(config) {
    let connection = config.connection;

    this.__connection = {
      layers: []
    };

    let layers = connection.layers;
    let previousLayer = null;
    for (let j = 0; j < layers.length; j++) {
      let layerObj = layers[j];
      let layerType = null;
      let layerOptions = null;
      if (typeof layerObj === 'string') {
        layerType = layerObj;
      } else {
        layerType = layerObj.type;
        layerOptions = layerObj.options;
      }
      let LayerClass = Driver.__getLayerClass(layerType);
      let layer = null;

      if (previousLayer != null) {
        layer = new LayerClass(previousLayer, layerOptions);
      } else {
        layer = new LayerClass(layerOptions);
      }
      previousLayer = layer;
      this.__connection.layers.push(layer);
    }

    let connectionLayers = this.__connection.layers;

    this.__rootLayer = connectionLayers[0];
    this.__topLayer = connectionLayers[connectionLayers.length - 1];

    this.__registeredActions = connection.actions;
  }

  __setupTags(config) {
    this.__tags = config.tags;
  }

  action(action, tagName, setup) {
    let tag = this.__tags[tagName];
    if (tag == null) {
      throw new Error('Tag not available: ' + tagName);
    }

    if (tag.actions != null) {
      tag = tag.actions[action];
      if (tag == null) {
        throw new Error('Tag alias action not available: ' + tagName + ', ' + action);
      }
    }

    let layerActionName = this.__registeredActions[action];
    if (layerActionName == null || layerActionName.length === 0) {
      throw new Error('Layer is not registered for action in configuration file: ' + action);
    }

    let layer = this.__topLayer;
    let layerAction = layer[layerActionName];
    if (layerAction == null) {
      throw new Error('Layer does not have action: ' + layerActionName);
    }

    let useSetup = setup != null && typeof setup == 'function';

    return {
      useSetup,
      setup,
      layerAction,
      layer,
      tag
    }
  }

  execute(action, payload, cb) {
    if (cb == null) {
      cb = payload;
      payload = null;
    }

    let receiver = function(err, result) {
      if (cb) {
        let ctx = {
          direction: 'in',
          action
        };

        cb(err, result, ctx);
      }
    };

    let ctx = {
      direction: 'out',
      action
    };

    if (payload != null) {
      if (action.useSetup) {
        payload = action.setup(ctx, payload);
      }
      action.layerAction.call(
        action.layer,
        action.tag.address,
        payload,
        receiver
      );
    } else {
      action.layerAction.call(
        action.layer,
        action.tag.address,
        receiver
      );
    }
  }

  interpolate(ctx, value) {
    if (ctx.action.tag.interpolation != null) {
      if (ctx.direction === 'in') {
        return interpolateIn(ctx.action.tag.interpolation, value);
      } else if (ctx.direction === 'out') {
        return interpolateOut(ctx.action.tag.interpolation, value);
      }
    }
    return value;
  }


  close(cb) {
    if (this.__rootLayer != null) {
      this.__rootLayer.close(function() {
        if (cb != null) {
          cb();
        }
      });
    } else if (cb != null) {
      cb();
    }
  }

  static __getLayerClass(layerType) {
    let LayerClass = null;
    switch (layerType) {
      case 'TCPLayer':
        LayerClass = Drivers.Layers.TCPLayer;
        break;
      case 'EIPLayer':
        LayerClass = Drivers.Layers.EIPLayer;
        break;
      case 'MBTCPLayer':
        LayerClass = Drivers.Layers.MBTCPLayer;
        break;
      case 'PCCCLayer':
        LayerClass = Drivers.Layers.PCCCLayer;
        break;
      case 'PCCC':
        LayerClass = Drivers.Layers.CIP.PCCC;
        break;
      case 'Connection':
        LayerClass = Drivers.Layers.CIP.Connection;
        break;
      case 'ControlLogix':
        LayerClass = Drivers.Layers.CIP.ControlLogix;
        break;
      default:
        return null;
    }

    return LayerClass;
  }

  static ValidateConfig(config) {
    if (typeof config === 'string') {
      config = require(config);
    }

    if (config.connection == null) {
      return '\'connection\' must be specified';
    }

    if (config.connection.layers == null) {
      return '\'connection.layers\' must be specified';
    }

    if (!Array.isArray(config.connection.layers)) {
      return '\'connection.layers\' must be an array';
    }

    for (let i = 0; i < config.connection.layers.length; i++) {
      let layer = config.connection.layers[i];
      let layerType = null;
      if (typeof layer === 'string') {
        layerType = layer;
      } else if (layer.type == null || layer.type.length === 0) {
        return 'Layer \'type\' must be specified';
      } else {
        layerType = layer.type;
      }

      if (Driver.__getLayerClass(layerType) == null) {
        return '\'Layer type is not availale: ' + layerType;
      }
    }

    let tagChecker = function(tag) {
      if (isEmptyString(tag.address)) {
        return 'rawTag \'address\' must be specified: ' + tagStr;
      }

      if (tag.interpolation != null) {
        if (tag.interpolation.type == null || tag.interpolation.type.length === 0) {
          return 'rawTag interpolation \'type\' must be specified: ' + tagStr;
        }

        if (INTERPOLATION_TYPES[tag.interpolation.type] == null) {
          return 'rawTag interpolation type \'' + tag.interpolation.type + '\' is not available: ' + tagStr;
        }

        if (tag.interpolation.type === 'linear') {
          if (tag.interpolation.raw == null) {
            return 'rawTag linear interpolation must specify \'raw\': ' + tagStr;
          }

          if (!Array.isArray(tag.interpolation.raw)) {
            return 'rawTag linear interpolation \'raw\' must be an array:' + tagStr;
          }

          if (tag.interpolation.raw.length !== 2) {
            return 'rawTag linear interpolation \'raw\' must specify two values:'  + tagStr;
          }

          if (tag.interpolation.eu == null) {
            return 'rawTag linear interpolation must specify \'eu\': ' + tagStr;
          }

          if (!Array.isArray(tag.interpolation.eu)) {
            return 'rawTag linear interpolation \'eu\' must be an array:' + tagStr;
          }

          if (tag.interpolation.eu.length !== 2) {
            return 'rawTag linear interpolation \'eu\' must specify two values:'  + tagStr;
          }
        }
      }

      return null;
    };

    if (config.tags != null) {
      let tags = config.tags;
      let keys = Object.keys(config.tags);
      for (let i = 0; i < keys.length; i++) {
        let tag = config.tags[keys[i]];
        let tagStr = JSON.stringify(tag, null, 2);
        let tagErr = null;

        if (tag.actions == null) {
          tagErr = tagChecker(tag);
        } else {
          let actions = Object.keys(tag.actions);
          for (let j = 0; j < actions.length; j++) {
            tagErr = tagChecker(actions[j]);
            if (!isEmptyString(tagErr)) {
              break;
            }
          }
        }

        if (!isEmptyString(tagErr)) {
          return tagErr;
        }
      }
    }
  }
}

module.exports = Driver;

function isEmptyString(str) {
  return str == null || str.length === 0;
}

// class Driver {
//   constructor(config) {
//     if (typeof config === 'string') {
//       config = require(config);
//     }
//
//     this.__setup(config);
//   }
//
//   __setup(config) {
//     this.__setupConnection(config);
//     this.__setupRawTags(config);
//     this.__setupTags(config);
//   }
//
//   __setupConnection(config) {
//     let connection = config.connection;
//
//     this.__connection = {
//       layers: []
//     };
//
//     let layers = connection.layers;
//     let previousLayer = null;
//     for (let j = 0; j < layers.length; j++) {
//       let layerObj = layers[j];
//       let layerType = null;
//       let layerOptions = null;
//       if (typeof layerObj === 'string') {
//         layerType = layerObj;
//       } else {
//         layerType = layerObj.type;
//         layerOptions = layerObj.options;
//       }
//       let LayerClass = Driver.__getLayerClass(layerType);
//       let layer = null;
//
//       if (previousLayer != null) {
//         layer = new LayerClass(previousLayer, layerOptions);
//       } else {
//         layer = new LayerClass(layerOptions);
//       }
//       previousLayer = layer;
//       this.__connection.layers.push(layer);
//     }
//
//     let connectionLayers = this.__connection.layers;
//
//     this.__rootLayer = connectionLayers[0];
//     this.__topLayer = connectionLayers[connectionLayers.length - 1];
//   }
//
//   __setupRawTags(config) {
//     this.__rawTags = config.rawTags;
//   }
//
//   __setupTags(config) {
//     this.__tags = config.tags;
//   }
//
//   action(action, tagName, setup) {
//     let tagActions = this.__tags[tagName];
//     if (tagActions == null && cb != null) {
//       throw new Error('Tag not available: ' + tagName);
//     }
//
//     let tagId = tagActions[action];
//     if ((tagId == null || tagId.length === 0) && cb != null) {
//       throw new Error('Action not available for tag: ' + tagName + ', ' + action);
//     }
//
//     let rawTag = this.__rawTags[tagId];
//     if (rawTag == null && cb != null) {
//       throw new Error('Raw tag not available for tag action: ' + tagName + ', ' + action);
//     }
//
//     let layer = this.__topLayer;
//     let layerAction = layer[rawTag.action];
//     if (layerAction == null) {
//       throw new Error('Layer does not have action: ' + rawTag.action);
//     }
//
//     let useSetup = setup != null && typeof setup == 'function';
//
//     return {
//       useSetup,
//       setup,
//       layerAction,
//       layer,
//       rawTag
//     }
//   }
//
//   execute(action, payload, cb) {
//     if (cb == null) {
//       cb = payload;
//       payload = null;
//     }
//
//     let receiver = function(err, result) {
//       if (cb) {
//         let ctx = {
//           direction: 'in',
//           action
//         };
//
//         cb(err, result, ctx);
//       }
//     };
//
//     let ctx = {
//       direction: 'out',
//       action
//     };
//
//     if (payload != null) {
//       if (action.useSetup) {
//         payload = action.setup(ctx, payload);
//       }
//       action.layerAction.call(
//         action.layer,
//         action.rawTag.address,
//         payload,
//         receiver
//       );
//     } else {
//       action.layerAction.call(
//         action.layer,
//         action.rawTag.address,
//         receiver
//       );
//     }
//   }
//
//   interpolate(ctx, value) {
//     if (ctx.action.rawTag.interpolation != null) {
//       if (ctx.direction === 'in') {
//         return interpolateIn(ctx.action.rawTag.interpolation, value);
//       } else if (ctx.direction === 'out') {
//         return interpolateOut(ctx.action.rawTag.interpolation, value);
//       }
//     }
//     return value;
//   }
//
//
//   close(cb) {
//     if (this.__rootLayer != null) {
//       this.__rootLayer.close(function() {
//         if (cb != null) {
//           cb();
//         }
//       });
//     } else if (cb != null) {
//       cb();
//     }
//   }
//
//   static __getLayerClass(layerType) {
//     let LayerClass = null;
//     switch (layerType) {
//       case 'TCPLayer':
//         LayerClass = Drivers.Layers.TCPLayer;
//         break;
//       case 'EIPLayer':
//         LayerClass = Drivers.Layers.EIPLayer;
//         break;
//       case 'MBTCPLayer':
//         LayerClass = Drivers.Layers.MBTCPLayer;
//         break;
//       case 'PCCCLayer':
//         LayerClass = Drivers.Layers.PCCCLayer;
//         break;
//       case 'PCCC':
//         LayerClass = Drivers.Layers.CIP.PCCC;
//         break;
//       case 'Connection':
//         LayerClass = Drivers.Layers.CIP.Connection;
//         break;
//       case 'ControlLogix':
//         LayerClass = Drivers.Layers.CIP.ControlLogix;
//         break;
//       default:
//         return null;
//     }
//
//     return LayerClass;
//   }
//
//   static ValidateConfig(config) {
//     if (typeof config === 'string') {
//       config = require(config);
//     }
//
//     if (config.connection == null) {
//       return '\'connection\' must be specified';
//     }
//
//     if (config.connection.layers == null) {
//       return '\'connection.layers\' must be specified';
//     }
//
//     if (!Array.isArray(config.connection.layers)) {
//       return '\'connection.layers\' must be an array';
//     }
//
//     for (let i = 0; i < config.connection.layers.length; i++) {
//       let layer = config.connection.layers[i];
//       let layerType = null;
//       if (typeof layer === 'string') {
//         layerType = layer;
//       } else if (layer.type == null || layer.type.length === 0) {
//         return 'Layer \'type\' must be specified';
//       } else {
//         layerType = layer.type;
//       }
//
//       if (Driver.__getLayerClass(layerType) == null) {
//         return '\'Layer type is not availale: ' + layerType;
//       }
//     }
//
//     if (config.rawTags != null) {
//       let keys = Object.keys(config.rawTags);
//       for (let i = 0; i < keys.length; i++) {
//         let tag = config.rawTags[keys[i]];
//         let tagStr = JSON.stringify(tag, null, 2);
//
//         if (tag.action == null || tag.action.length === 0) {
//           return 'rawTag \'action\' must be specified: ' + tagStr;
//         }
//
//         if (tag.address == null || tag.address.length === 0) {
//           return 'rawTag \'address\' must be specified: ' + tagStr;
//         }
//
//         if (tag.interpolation != null) {
//           if (tag.interpolation.type == null || tag.interpolation.type.length === 0) {
//             return 'rawTag interpolation \'type\' must be specified: ' + tagStr;
//           }
//
//           if (INTERPOLATION_TYPES[tag.interpolation.type] == null) {
//             return 'rawTag interpolation type \'' + tag.interpolation.type + '\' is not available: ' + tagStr;
//           }
//
//           if (tag.interpolation.type === 'linear') {
//             if (tag.interpolation.raw == null) {
//               return 'rawTag linear interpolation must specify \'raw\': ' + tagStr;
//             }
//
//             if (!Array.isArray(tag.interpolation.raw)) {
//               return 'rawTag linear interpolation \'raw\' must be an array:' + tagStr;
//             }
//
//             if (tag.interpolation.raw.length !== 2) {
//               return 'rawTag linear interpolation \'raw\' must specify two values:'  + tagStr;
//             }
//
//             if (tag.interpolation.eu == null) {
//               return 'rawTag linear interpolation must specify \'eu\': ' + tagStr;
//             }
//
//             if (!Array.isArray(tag.interpolation.eu)) {
//               return 'rawTag linear interpolation \'eu\' must be an array:' + tagStr;
//             }
//
//             if (tag.interpolation.eu.length !== 2) {
//               return 'rawTag linear interpolation \'eu\' must specify two values:'  + tagStr;
//             }
//           }
//         }
//       }
//     }
//
//     if (config.tags != null) {
//       let tagKeys = Object.keys(config.tags);
//       for (let i = 0; i < tagKeys.length; i++) {
//         let tag = config.tags[tagKeys[i]];
//         let tagActionKeys = Object.keys(tag);
//         for (let j = 0; j < tagActionKeys.length; j++) {
//           let rawTagId = tag[tagActionKeys[j]];
//           if (config.rawTags == null || config.rawTags[rawTagId] == null) {
//             return 'rawTag does not exist for tag \'' + tagKeys[i] + '\', action \'' + tagActionKeys[j] + '\'';
//           }
//         }
//       }
//     }
//   }
// }
//
// module.exports = Driver;




function interpolateOut(interpolation, value) {
  switch (interpolation.type) {
    case 'linear':
      value = linearInterpolateOut(interpolation, value);
      break;
    default:

  }
  return value;
}

function interpolateIn(interpolation, value) {
  switch (interpolation.type) {
    case 'linear':
      value = linearInterpolateIn(interpolation, value);
      break;
    default:

  }
  return value;
}

function linearInterpolateOut(interpolation, value) {
  let x0 = interpolation.eu[0];
  let x1 = interpolation.eu[1];
  let y0 = interpolation.raw[0];
  let y1 = interpolation.raw[1];

  return y0 + (value - x0) * (y1 - y0) / (x1 - x0);
}

function linearInterpolateIn(interpolation, value) {
  let x0 = interpolation.raw[0];
  let x1 = interpolation.raw[1];
  let y0 = interpolation.eu[0];
  let y1 = interpolation.eu[1];

  return y0 + (value - x0) * (y1 - y0) / (x1 - x0);
}
