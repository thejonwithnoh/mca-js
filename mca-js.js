var zlib = require('zlib');

var mca = module.exports = function(data)
{
	this.data = data;
};

mca.config =
{
	chunk:
	{
		sector:
		{
			offsetSize: 3,
			countSize: 1,
			get detailsSize () { return this.offsetSize + this.countSize; }
		},
		timestampSize: 4,
		data:
		{
			byteCountSize: 4,
			compressionTypeSize: 1,
			get detailsSize () { return this.byteCountSize + this.compressionTypeSize; }
		}
	},
	region:
	{
		linearChunk:
		{
			countPower: 5,
			get count () { return 1 << this.countPower; },
			get countMask () { return this.count - 1; }
		}
	},
	sector:
	{
		sizePower: 12,
		get size () { return 1 << this.sizePower; }
	}
};

mca.compressionTypes =
{
	gzip:
	{
		value: 1,
		compress: zlib.gzip,
		compressSync: zlib.gzipSync,
		decompress: zlib.gunzip,
		decompressSync: zlib.gunzipSync
	},
	zlib:
	{
		value: 2,
		compress: zlib.deflate,
		compressSync: zlib.deflateSync,
		decompress: zlib.inflate,
		decompressSync: zlib.inflateSync
	}
};

(function()
{
	for (var compressionTypeName in mca.compressionTypes)
	{
		if (mca.compressionTypes.hasOwnProperty(compressionTypeName))
		{
			var compressionType = mca.compressionTypes[compressionTypeName];
			compressionType.name = compressionTypeName;
			mca.compressionTypes[compressionType.value] = compressionType;
		}
	}
})();

var getDataLocationLocation = function(x, z)
{
	return mca.config.chunk.sector.detailsSize * ((x & mca.config.region.linearChunk.countMask) | ((z & mca.config.region.linearChunk.countMask) << mca.config.region.linearChunk.countPower));
};

var getSectorCountLocation = function(x, z)
{
	return getDataLocationLocation(x, z) + mca.config.chunk.sector.offsetSize;
};

var getTimestampLocation = function(x, z)
{
	return getDataLocationLocation(x, z) + mca.config.sector.size;
};

mca.prototype =
{
	constructor: mca,
	getDataLocation: function(x, z)
	{
		return this.data.readUIntBE(getDataLocationLocation(x, z), mca.config.chunk.sector.offsetSize) << mca.config.sector.sizePower;
	},
	getSectorCount: function(x, z)
	{
		return this.data.readUIntBE(getSectorCountLocation(x, z), mca.config.chunk.sector.countSize);
	},
	getTimestamp: function(x, z)
	{
		return this.data.readUIntBE(getTimestampLocation(x, z), mca.config.chunk.timestampSize);
	},
	getDataSize: function(x, z)
	{
		return this.data.readUIntBE(this.getDataLocation(x, z), mca.config.chunk.data.byteCountSize) - mca.config.chunk.data.compressionTypeSize;
	},
	getCompressionType: function(x, z)
	{
		return mca.compressionTypes[this.data.readUIntBE(this.getDataLocation(x, z) + mca.config.chunk.data.byteCountSize, mca.config.chunk.data.compressionTypeSize)];
	},
	getData: function(x, z)
	{
		var dataStart = this.getDataLocation(x, z);
		if (dataStart)
		{
			var payloadStart = dataStart + mca.config.chunk.data.detailsSize;
			var payloadEnd = this.getDataSize(x, z) + payloadStart;
			var payload = this.data.slice(payloadStart, payloadEnd);
			return this.getCompressionType(x, z).decompressSync(payload);
		}
	}
};