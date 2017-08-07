import * as cli from "../../definitions/cli";
import * as crypto from "crypto";
import * as fs from "fs";
import * as hashUtils from "../hash-utils";
import * as jwt from "jsonwebtoken";
import * as os from "os";
import * as path from "path";
import * as q from "q";
var rimraf = require("rimraf");
import AccountManager = require("code-push");

var CURRENT_CLAIM_VERSION: string = "1.0.0";
var METADATA_FILE_NAME: string = ".codepushrelease"

interface CodeSigningClaims {
    claimVersion: string;
    contentHash: string;
}

var sign: cli.ReleaseHook = (currentCommand: cli.IReleaseCommand, originalCommand: cli.IReleaseCommand, sdk: AccountManager): q.Promise<cli.IReleaseCommand> => {
    if (!currentCommand.signingKeyPath) {
        return q.resolve<cli.IReleaseCommand>(currentCommand);
    }

    var signingKey: Buffer;
    var signatureFilePath: string;

    return q(<void>null)
        .then(() => {
            try {
                signingKey = fs.readFileSync(currentCommand.signingKeyPath);
            } catch (err) {
                return q.reject(new Error(`The path specified for the signing key ("${currentCommand.signingKeyPath}") was not valid`));
            }

            if (!fs.lstatSync(currentCommand.package).isDirectory()) {
                // If releasing a single file, copy the file to a temporary 'CodePush' directory in which to publish the release
                var outputFolderPath: string = path.join(os.tmpdir(), "CodePush");
                rimraf.sync(outputFolderPath);
                fs.mkdirSync(outputFolderPath);

                var outputFilePath: string = path.join(outputFolderPath, path.basename(currentCommand.package));
                fs.writeFileSync(outputFilePath, fs.readFileSync(currentCommand.package));

                currentCommand.package = outputFolderPath;
            }

            signatureFilePath = path.join(currentCommand.package, METADATA_FILE_NAME);
            var prevSignatureExists = true;
            try {
                fs.accessSync(signatureFilePath, fs.F_OK);
            } catch (err) {
                if (err.code === "ENOENT") {
                    prevSignatureExists = false;
                } else {
                    return q.reject<string>(new Error(
                        `Could not delete previous release signature at ${signatureFilePath}.
                        Please, check your access rights.`)
                    );
                }
            }

            if (prevSignatureExists) {
                console.log(`Deleting previous release signature at ${signatureFilePath}`);
                rimraf.sync(signatureFilePath);
            }

            return hashUtils.generatePackageHashFromDirectory(currentCommand.package, path.join(currentCommand.package, ".."));
        })
        .then((hash: string) => {
            var claims: CodeSigningClaims = {
                claimVersion: CURRENT_CLAIM_VERSION,
                contentHash: hash
            };
            
            return q.nfcall<string>(jwt.sign, claims, signingKey, { algorithm: "RS256" })
                .catch((err: Error) => {
                    return q.reject<string>(new Error("The specified signing key file was not valid"));
                });
        })
        .then((signedJwt: string) => {
            var deferred = q.defer<void>();

            fs.writeFile(signatureFilePath, signedJwt, (err: Error) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    console.log(`Generated a release signature and wrote it to ${signatureFilePath}`);
                    deferred.resolve(<void>null);
                }
            });

            return deferred.promise;
        })
        .then(() => { return currentCommand; })
        .catch((err: Error) => {           
            
            err.message = `Could not sign package: ${err.message}`;
            return q.reject<cli.IReleaseCommand>(err);
    });
}

export = sign;