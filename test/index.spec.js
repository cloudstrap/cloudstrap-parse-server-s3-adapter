const assert = require('assert');
const nock = require('nock');

const SashidoS3Adapter = require('../');

const url = 'http://proxy-url.com';
describe('sashido s3 adapter', () => {
    const adapter = new SashidoS3Adapter({
        appId: 'appId',
        masterKey: 'masterKey',
        bucket: 'bucket',
        bucketPrefix: 'bucket_prefix',
        proxyUrl: url,
        retryDelays: [0, 20, 50]
    });

    describe('delete file', () => {
        it('should delete file', async () => {
            nock(url)
                .post('/deleteFile')
                .once()
                .reply(200, function(uri, requestBody) {
                    assert.equal(requestBody, 'file=file.jpg');
                });

            await adapter.deleteFile('file.jpg');
        });

        it('should throw error', async () => {
            nock(url)
                .post('/deleteFile')
                .once()
                .reply(403);

            let err;
            try {
                await adapter.deleteFile('file.jpg');
            } catch (e) {
                err = e;
            }

            assert(err);
        });
    });

    describe('create file', () => {
        it('should create corrent upload', () => {
            const data = Buffer.from([1, 2, 3, 4]);
            const cb = () => {};

            const upload = adapter._newUpload({
                filename: 'test.jpg',
                contentType: 'jpeg',
                data,
                onError: cb,
                onProgress: cb,
                onSuccess: cb
            });

            assert(upload);
            assert.equal(upload.file, data);

            const opts = upload.options;
            assert.equal(opts.endpoint, `${url}/2/files/`);
            assert.deepEqual(opts.retryDelays, [0, 20, 50]);
            assert.deepEqual(opts.headers, {
                'X-Parse-Application-Id': 'appId',
                'X-Parse-Master-key': 'masterKey'
            });
            assert.equal(opts.onError, cb);
            assert.equal(opts.onSuccess, cb);
            assert.equal(opts.onProgress, cb);
            assert.equal(opts.metadata.filename, 'bucket_prefixtest.jpg');
            assert.equal(opts.metadata.filetype, 'jpeg');
        });
    });
});
