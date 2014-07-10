/**
 * JSONSchema Validator - Validates JavaScript objects using JSON Schemas
 *	(http://www.json.com/json-schema-proposal/)
 *
 * Copyright (c) 2007 Kris Zyp SitePen (www.sitepen.com)
 * Licensed under the MIT (MIT-LICENSE.txt) license.
To use the validator call the validate function with an instance object and an optional schema object.
If a schema is provided, it will be used to validate. If the instance object refers to a schema (self-validating),
that schema will be used to validate and the schema parameter is not necessary (if both exist,
both validations will occur).
The validate method will return an array of validation errors. If there are no errors, then an
empty list will be returned. A validation error will have two properties:
"property" which indicates which property had the error
"message" which indicates what the error was
 */
({define:typeof define!="undefined"?define:function(deps, factory){module.exports = factory();}}).
define([], function(){
var exports = validate;
// setup primitive classes to be JSON Schema types
exports.Integer = {type:"integer"};
var primitiveConstructors = {
	String: String,
	Boolean: Boolean,
	Number: Number,
	Object: Object,
	Array: Array,
	Date: Date
};
exports.validate = validate;
function validate(/*Any*/instance,/*Object*/schema) {
		// Summary:
		//  	To use the validator call JSONSchema.validate with an instance object and an optional schema object.
		// 		If a schema is provided, it will be used to validate. If the instance object refers to a schema (self-validating),
		// 		that schema will be used to validate and the schema parameter is not necessary (if both exist,
		// 		both validations will occur).
		// 		The validate method will return an object with two properties:
		// 			valid: A boolean indicating if the instance is valid by the schema
		// 			errors: An array of validation errors. If there are no errors, then an
		// 					empty list will be returned. A validation error will have two properties:
		// 						property: which indicates which property had the error
		// 						message: which indicates what the error was
		//
		return validate(instance, schema, {changing: false});//, coerce: false, existingOnly: false});
	};
exports.checkPropertyChange = function(/*Any*/value,/*Object*/schema, /*String*/property) {
		// Summary:
		// 		The checkPropertyChange method will check to see if an value can legally be in property with the given schema
		// 		This is slightly different than the validate method in that it will fail if the schema is readonly and it will
		// 		not check for self-validation, it is assumed that the passed in value is already internally valid.
		// 		The checkPropertyChange method will return the same object type as validate, see JSONSchema.validate for
		// 		information.
		//
		return validate(value, schema, {changing: property || "property"});
	};
var validate = exports._validate = function(/*Any*/instance,/*Object*/schema,/*Object*/options) {

	if (!options) options = {};
	var _changing = options.changing;

	function getType(schema){
		return schema.type || (primitiveConstructors[schema.name] == schema && schema.name.toLowerCase());
	}
	var errors = [];
	// validate a value against a property definition
	function checkProp(value, schema, path, i){

		var l;
		if(typeof i !== 'undefined') {
			if(typeof i === 'number') {
				path += '[' + i + ']';
			} else {
				var escaped = i.replace(/\./g, '\\.');
				path += path ? ('.' + escaped) : escaped;
			}
		}
		function addError(message, value){
			var propMessage = "The property '" + i + "' " + message;
			var error = {property:path,message:propMessage,schema:schema};
			if(typeof value !== 'undefined') {
				error.value = value;
			}
			errors.push(error);
		}

		if((typeof schema != 'object' || schema instanceof Array) && (path || typeof schema != 'function') && !(schema && getType(schema))){
			if(typeof schema == 'function'){
				if(!(value instanceof schema)){
					addError("is not an instance of the class/constructor " + schema.name, value);
				}
			}else if(schema){
				addError("has an invalid schema/property definition " + schema);
			}
			return null;
		}
		if(_changing && schema.readonly){
			addError("is a readonly field, it can not be changed");
		}
		if(schema['extends']){ // if it extends another schema, it must pass that schema as well
			checkProp(value,schema['extends'],path,i);
		}
		// validate a value against a type definition
		function checkType(type,value){
			if(type){
				if(typeof type == 'string' && type != 'any' &&
						(type == 'null' ? value !== null : typeof value != type) &&
						!(value instanceof Array && type == 'array') &&
						!(value instanceof Date && type == 'date') &&
						!(typeof value === 'number' && type == 'integer' && value%1===0)){
					return [{property:path,message:(typeof value) + " value found, but a " + type + " is required",schema:schema,value:value}];
				}
				if(type instanceof Array){
					var unionErrors = [];
					var theseErrors = [];
					for(var j = 0; j < type.length; j++){ // a union type
						if(!(theseErrors=checkType(type[j],value)).length){
							break;
						}
						unionErrors.push.apply(unionErrors, theseErrors);
					}
					if(theseErrors.length){
						return unionErrors;
					}
				}else if(typeof type == 'object'){
					var priorErrors = errors;
					errors = [];
					checkProp(value,type,path);
					var theseErrors = errors;
					errors = priorErrors;
					return theseErrors;
				}
			}
			return [];
		}
		if(value === undefined){
			if(schema.required){
				addError("is missing and it is required");
			}
		}else{
			errors.push.apply(errors, checkType(getType(schema),value));
			if(schema.disallow && !checkType(schema.disallow,value).length){
				addError("matched a disallowed value", value);
			}
			if(value !== null){
				if(value instanceof Array){
					if(schema.items){
						var itemsIsArray = schema.items instanceof Array;
						var propDef = schema.items;
						for (var i = 0, l = value.length; i < l; i += 1) {
							if (itemsIsArray)
								propDef = schema.items[i];
							if (options.coerce)
								value[i] = options.coerce(value[i], propDef);
							checkProp(value[i],propDef,path,i);
						}
					}
					if(schema.minItems && value.length < schema.minItems){
						addError("must have a minimum of " + schema.minItems + " in the array", value);
					}
					if(schema.maxItems && value.length > schema.maxItems){
						addError("must have a maximum of " + schema.maxItems + " in the array", value);
					}
					if(schema.uniqueItems) {
						for(var i = 0, l = value.length; i < l; i += 1) {
							for(var j = i + 1; j < l; j += 1) {
								if(compareItems(value[i], value[j])) {
									addError("must have unique items in the array", value);
									break;
								}
							}
						}
					}
				}
				if(schema.properties || schema.additionalProperties){
					checkObj(value, schema.properties, path, schema.additionalProperties);
				}
				if(schema.pattern && typeof value == 'string' && !value.match(schema.pattern)){
					addError("does not match the regex pattern '" + schema.pattern + "'", value);
				}
				if(schema.maxLength && typeof value == 'string' && value.length > schema.maxLength){
					addError("may only be " + schema.maxLength + " characters long", value);
				}
				if(schema.minLength && typeof value == 'string' && value.length < schema.minLength){
					addError("must be at least " + schema.minLength + " characters long", value);
				}
				if(typeof schema.minimum !== undefined && typeof value == typeof schema.minimum &&
						schema.minimum > value){
					addError("must have a minimum value of " + schema.minimum, value);
				}
				if(typeof schema.maximum !== undefined && typeof value == typeof schema.maximum &&
						schema.maximum < value){
					addError("must have a maximum value of " + schema.maximum, value);
				}
				if(schema['enum']){
					var enumer = schema['enum'];
					l = enumer.length;
					var found;
					for(var j = 0; j < l; j++){
						if(enumer[j]===value){
							found=1;
							break;
						}
					}
					if(!found){
						addError("does not have a value in the enumeration " + enumer.join(", "), value);
					}
				}
				if(typeof schema.maxDecimal == 'number' &&
					(value.toString().match(new RegExp("\\.[0-9]{" + (schema.maxDecimal + 1) + ",}")))){
					addError("may only have " + schema.maxDecimal + " digits of decimal places", value);
				}
			}
		}
		return null;
	}
	// validate an object against a schema
	function checkObj(instance,objTypeDef,path,additionalProp){

		function addError(message, value){
			var error = {property:path,message:message,schema:objTypeDef};
			if(typeof value !== 'undefined') {
				error.value = value;
			}
			errors.push(error);
		}

		if(typeof objTypeDef =='object'){
			if(typeof instance != 'object' || instance instanceof Array){
				addError("An object is required", instance);
			}

			for(var i in objTypeDef){
				if(objTypeDef.hasOwnProperty(i)){
					var value = instance[i];
					// skip _not_ specified properties
					if (value === undefined && options.existingOnly) continue;
					var propDef = objTypeDef[i];
					// set default
					if(value === undefined && propDef["default"]){
						value = instance[i] = propDef["default"];
					}
					if(options.coerce && i in instance){
						value = instance[i] = options.coerce(value, propDef);
					}
					checkProp(value,propDef,path,i);
				}
			}
		}
		for(var i in instance){
			if(instance.hasOwnProperty(i) && !(i.charAt(0) == '_' && i.charAt(1) == '_') && objTypeDef && !objTypeDef[i] && additionalProp===false){
				if (options.filter) {
					delete instance[i];
					continue;
				} else {
					addError("The property '" + i +
						"' is not defined in the schema and the schema does not allow additional properties", instance);
				}
			}
			var requires = objTypeDef && objTypeDef[i] && objTypeDef[i].requires;
			if(requires && !(requires in instance)){
				addError("The presence of the property " + i + " requires that " + requires + " also be present", instance);
			}
			value = instance[i];
			if(additionalProp && (!(objTypeDef && typeof objTypeDef == 'object') || !(i in objTypeDef))){
				if(options.coerce){
					value = instance[i] = options.coerce(value, additionalProp);
				}
				checkProp(value,additionalProp,path,i);
			}
			if(!_changing && value && value.$schema){
				checkProp(value,value.$schema,path,i);
			}
		}
		return errors;
	}
	// compare a value against another for equality (for uniqueItems)
	function compareItems(item1, item2) {
		if(typeof item1 !== typeof item2) {
			return false;
		}
		if(Array.isArray(item1)) {
			if(item1.length !== item2.length) {
				return false;
			}
			for(var i = 0, l = item1.length; i < l; i += 1) {
				if(!compareItems(item1[i], item2[i])) {
					return false;
				}
			}
			return true;
		}
		if(item1 instanceof Object) {
			var item1Keys = Object.keys(item1);
			var item2Keys = Object.keys(item2);
			if(item1Keys.length !== item2Keys.length) {
				return false;
			}
			for(var i = 0, l = item1Keys.length; i < l; i += 1) {
				var key = item1Keys[i];
				if(!item2.hasOwnProperty(key) ||
					!compareItems(item1[key], item2[key])) {
					return false;
				}
			}
			return true;
		}
		return item1 === item2;
	}
	if(schema){
		checkProp(instance,schema,'',_changing || '');
	}
	if(!_changing && instance && instance.$schema){
		checkProp(instance,instance.$schema,'','');
	}
	return {valid:!errors.length,errors:errors};
};
exports.mustBeValid = function(result){
	//	summary:
	//		This checks to ensure that the result is valid and will throw an appropriate error message if it is not
	// result: the result returned from checkPropertyChange or validate
	if(!result.valid){
		throw new TypeError(result.errors.map(function(error){return "for property " + error.property + ': ' + error.message;}).join(", \n"));
	}
}

return exports;
});
