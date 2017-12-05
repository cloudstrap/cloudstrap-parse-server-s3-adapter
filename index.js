'use strict';

var request = require('request');
var _ = require('lodash');

var SashidoS3Adapter = function SashidoS3Adapter(opts) {
    this._appId = opts.appId;
    this._directAccess = opts.directAccess;
    this._baseUrlDirect = opts.baseUrlDirect;
    this._masterKey = opts.masterKey;
    this._useAccelerateEndpoint = opts.useAccelerateEndpoint;
    this._bucket = opts.bucket;
    this._bucketPrefix = opts.bucketPrefix || '';
    this._baseUrl = opts.baseUrl;
    this._proxyUrl = opts.proxyUrl;
    if (this._proxyUrl[this._proxyUrl.length - 1] !== '/') {
        this._proxyUrl += '/';
    }
};

SashidoS3Adapter.prototype._requestOpts = function _requestOpts(
    endpoint,
    ext,
    headers
) {
    var opts = {
        url: '' + this._proxyUrl + endpoint,
        headers: _.extend(
            {
                'X-Parse-Application-Id': this._appId,
                'X-Parse-Master-key': this._masterKey
            },
            headers
        )
    };

    return _.extend(opts, ext);
};

SashidoS3Adapter.prototype._requestPromise = function _requestPromise(opts) {
    return new Promise(function(resolve, reject) {
        request.post(opts, function(err, httpResponse, body) {
            if (err) {
                return reject(err);
            } else if (httpResponse.statusCode !== 200) {
                return reject();
            }

            return resolve({ httpResponse: httpResponse, body: body });
        });
    });
};

SashidoS3Adapter.prototype.createFile = function createFile(
    filename,
    data,
    contentType
) {
    var requestOpts = this._requestOpts(
        'uploadFile',
        {
            formData: {
                upload: {
                    value: data,
                    options: { filename: filename }
                }
            }
        },
        {
            'X-Content-Type': contentType
        }
    );

    return this._requestPromise(requestOpts).then(function(res) {
        return {
            location: res.body.location
        };
    });
};

SashidoS3Adapter.prototype.deleteFile = function deleteFile(filename) {
    var requestOpts = this._requestOpts('deleteFile', {
        form: {
            file: filename
        }
    });

    return this._requestPromise(requestOpts).then(function(res) {
        return res.body;
    });
};

SashidoS3Adapter.prototype.getFileData = function getFileData(filename) {
    var requestOpts = this._requestOpts('getObject', {
        form: {
            file: filename
        }
    });

    return this._requestPromise(requestOpts).then(function(res) {
        return Buffer.from(res.body);
    });
};

SashidoS3Adapter.prototype.getFileLocation = function getFileLocation(
    config,
    filename
) {
    filename = encodeURIComponent(filename);
    if (this._directAccess) {
        if (this._baseUrl && this._baseUrlDirect) {
            return this._baseUrl + '/' + filename;
        } else if (this._baseUrl) {
            return this._baseUrl + '/' + (this._bucketPrefix + filename);
        } else {
            var accelerate = this._useAccelerateEndpoint ? '-accelerate' : '';
            return (
                'https://' +
                this._bucket +
                '.s3' +
                accelerate +
                '.amazonaws.com/' +
                (this._bucketPrefix + filename)
            );
        }
    }
    return config.mount + '/files/' + config.applicationId + '/' + filename;
};

module.exports = SashidoS3Adapter;
module.exports.default = SashidoS3Adapter;
