const request = require('request');
const { Upload } = require('tus-js-client');

const API_VERSION = 2;
class SashidoS3Adapter {
    constructor({
        appId,
        masterKey,
        directAccess,
        baseUrlDirect,
        useAccelerateEndpoint,
        bucket,
        bucketPrefix,
        baseUrl,
        retryDelays,
        proxyUrl
    }) {
        this._appId = appId;
        this._masterKey = masterKey;
        this._directAccess = directAccess;
        this._baseUrlDirect = baseUrlDirect;
        this._useAccelerateEndpoint = useAccelerateEndpoint;
        this._bucket = bucket;
        this._bucketPrefix = bucketPrefix || '';
        this._baseUrl = baseUrl;
        this._retryDelays = retryDelays || [0, 1000, 3000, 5000];
        this._proxyUrl = proxyUrl;
        if (this._proxyUrl[this._proxyUrl.length - 1] !== '/') {
            this._proxyUrl += '/';
        }
        this._proxyUrl += `${API_VERSION}/`;
    }

    _requestHeaders(headers) {
        return {
            'X-Parse-Application-Id': this._appId,
            'X-Parse-Master-key': this._masterKey,
            ...headers
        };
    }

    _requestOpts(endpoint, ext, headers) {
        const opts = {
            url: '' + this._proxyUrl + endpoint,
            headers: this._requestHeaders(headers)
        };

        return { ...opts, ...ext };
    }

    _requestPromise(opts) {
        return new Promise(function(resolve, reject) {
            request.post(opts, function(err, httpResponse, body) {
                if (err) {
                    console.error(
                        `[S3Adapter Error] -> ${err.message ||
                            JSON.stringify(err)}`
                    );
                    return reject(err);
                } else if (httpResponse.statusCode !== 200) {
                    console.error(
                        `[S3Adapter StatusCode] -> ${httpResponse.statusCode}`
                    );
                    console.error(
                        `[S3Adapter Error] -> ${httpResponse.statusMessage}}`
                    );
                    return reject(new Error(httpResponse.statusMessage));
                }

                return resolve({ httpResponse: httpResponse, body: body });
            });
        });
    }

    async deleteFile(filename) {
        const requestOpts = this._requestOpts('deleteFile', {
            form: {
                file: filename
            }
        });

        const res = await this._requestPromise(requestOpts);
        return res.body;
    }

    async getFileData(filename) {
        const requestOpts = this._requestOpts('getObject', {
            form: {
                file: filename
            }
        });

        const res = await this._requestPromise(requestOpts);
        return Buffer.from(res.body);
    }

    async getFileLocation(config, filename) {
        filename = encodeURIComponent(filename);
        if (this._directAccess) {
            if (this._baseUrl && this._baseUrlDirect) {
                return this._baseUrl + '/' + filename;
            } else if (this._baseUrl) {
                return this._baseUrl + '/' + (this._bucketPrefix + filename);
            } else {
                const accelerate = this._useAccelerateEndpoint
                    ? '-accelerate'
                    : '';
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
    }

    _newUpload({
        filename,
        data,
        contentType,
        onError,
        onProgress,
        onSuccess
    }) {
        return new Upload(data, {
            endpoint: `${this._proxyUrl}/files/`,
            retryDelays: this._retryDelays,
            metadata: {
                filename: this._bucketPrefix + filename,
                filetype: contentType
            },
            headers: this._requestHeaders(),
            onError: onError,
            onProgress: onProgress,
            onSuccess: onSuccess
        });
    }

    createFile(filename, data, contentType) {
        return new Promise((resolve, reject) => {
            const upload = this._newUpload({
                filename,
                data,
                contentType,
                onError(err) {
                    console.error(`[S3Adapter Error] -> ${err.message}`);
                    return reject(err);
                },
                onProgress(bytesUploaded, bytesTotal) {
                    const percentage = (
                        bytesUploaded /
                        bytesTotal *
                        100
                    ).toFixed(2);
                    console.log(bytesUploaded, bytesTotal, percentage + '%');
                },
                onSuccess() {
                    return resolve({});
                }
            });
            upload.start();
        });
    }
}

module.exports = SashidoS3Adapter;
module.exports.default = SashidoS3Adapter;
