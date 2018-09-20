"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const object_notation_1 = require("./object-notation");
const yaml = __importStar(require("yamljs"));
class YamlObjectNotation extends object_notation_1.ObjectNotation {
    parse(value) {
        return yaml.parse(value);
    }
    stringify(value) {
        try {
            return yaml.stringify(object_notation_1.ObjectNotation.decycle(value), 10, 2);
        }
        catch (err) {
            /*nothing*/
        }
    }
    loadFromFileSync(filename) {
        return yaml.load(filename);
    }
}
exports.YamlObjectNotation = YamlObjectNotation;