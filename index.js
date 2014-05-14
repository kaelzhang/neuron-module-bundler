var walker = require('commonjs-walker');
var fs = require('fs');
var path = require('path');
var util = require('util');
var async = require('async');
var path = require('path');


var Parser = function(){};

Parser.prototype.parse = function(filepath,opt,callback){
    var self = this;
    var resolved = {};
    var pkg = opt.pkg;
    var targetVersion = opt.targetVersion;
    var allowNotInstalled = opt.allowNotInstalled;


    this.opt = opt;
    this.cwd = opt.cwd;
    this.pkg = opt.pkg;

    walker(filepath, {}, function(err, tree, nodes){
        if(err){
            return callback(err);
        }

        var result;

            var codes = Object.keys(nodes).map(function(key){
                return nodes[key];
            }).filter(function(mod){
                return !mod.isForeign;
            }).sort(function(a,b){
                return a.isEntryPoint ? 1 : -1;
            });


            async.map(codes, function(mod, done){
                self.generateWrapingCode(mod, done);    
            }, function(err, results){
                if(err){
                    return callback(err);
                }else{
                    callback(null, results.join("\n"));
                }
            });
    });
}


Parser.prototype.generateWrapingCode = function(mod, done){
    var pkg = this.pkg;
    var opt = this.opt;
    var main_id = [pkg.name, opt.targetVersion || pkg.version].join("@");
    var filepath = mod.id;
    var deps;
    var module_options = this.generateModuleOptions(mod);
    var id = this.generateId(filepath, main_id);
    var code = mod.code.toString().replace();
    var tpl = "define(\"%s\", %s, function(require, exports, module) {\n"
        + "%s\n"
    +"}, %s);";

    try{
        deps = this.resolveDependencies(mod);
    }catch(e){
        return done(e);
    }



    var result = util.format(tpl,
        id,
        JSON.stringify(deps),
        code,
        JSON.stringify(module_options,null,4)
    );
    done(null, result);
};


Parser.prototype.generateId = function(filepath,main_id,cwd) {
    // the exact identifier
    var cwd = this.cwd;
    var relative_path = path.relative(cwd, filepath);

    // -> 'folder/foo'
    var relative_id = relative_path.replace(/\.js$/, '');

    // -> 'module@0.0.1/folder/foo'
    var id = path.join(main_id, relative_id);
    return id;
}


Parser.prototype.isExternalDep = function(str){
    return ["../",".","/"].every(function(prefix){
        return str.indexOf(prefix) !== 0;
    });
}

Parser.prototype.outOfDir = function(dep, file){
    var cwd = this.cwd;
    var mod_path = path.join( path.dirname(file), dep);

    return mod_path.indexOf(cwd) == -1;
}


Parser.prototype.generateModuleOptions = function(mod){
    var self = this;
    var pkg = this.pkg;
    var cwd = this.cwd;
    var module_options = {};
    var depRef = pkg.asyncDependencies || {};
    var asyncDeps = Object.keys(depRef).map(function(name){
        var version = depRef[name];
        return [name,version].join("@");
    });

    if(asyncDeps.length){
        module_options.asyncDeps = asyncDeps;
    }

    var entryFile = pkg.main ?
        (path.extname(pkg.main) == "")
            ? (pkg.main + ".js")
            : pkg.main
        : "index.js";

    if(mod.isEntryPoint && mod.id === path.join(cwd, entryFile)){
        module_options.main = true;
    }

    return module_options;
}

Parser.prototype.resolveDependencies = function(mod){
    var self = this;
    var pkg = this.pkg;
    var cwd = this.cwd;
    var file = mod.id;
    var mods = mod.unresolvedDependencies;
    return mods.map(function(mod){
        var opt = self.opt;
        var resolved;

        if(self.isExternalDep(mod)){
            var version = (pkg.dependencies && pkg.dependencies[mod]) || (pkg.devDependencies && pkg.devDependencies[mod]);
            if(!version && opt.allowNotInstalled){
                version = "latest";
            }
            if(!version){
                throw new Error(util.format('Explicit version of dependency "%s" has not defined in package.json. Use "cortex install %s --save. file: %s',mod,mod,file));
            }
            resolved = mod + '@' + version;
        }else{
            if(self.outOfDir(mod, file)){
                throw new Error(util.format('Relative dependency "%s" out of main entry\'s directory. file: %s',mod,file));
            }
            resolved = mod;
        }

        return resolved;
    });
}


module.exports = function(filepath,opt,callback){
    var parser = new Parser();
    parser.parse(filepath,opt,callback);
}
