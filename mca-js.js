var nbt = require('nbt-js');
var zlib = require('zlib');

var mca = exports;

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

var getChunkLocationLocation = function(x, z)
{
	return mca.config.chunk.sector.detailsSize * ((x & mca.config.region.linearChunk.countMask) | ((z & mca.config.region.linearChunk.countMask) << mca.config.region.linearChunk.countPower));
};

var getChunkSizeLocation = function(x, z)
{
	return getChunkLocationLocation(x, z) + mca.config.chunk.sector.offsetSize;
};

var getChunkTimestampLocation = function(x, z)
{
	return getChunkLocationLocation(x, z) + mca.config.sector.size;
};

mca.getChunkLocation = function(data, x, z)
{
	return data.readUIntBE(getChunkLocationLocation(x, z), mca.config.chunk.sector.offsetSize) << mca.config.sector.sizePower;
};

mca.getChunkSize = function(data, x, z)
{
	return data.readUIntBE(getChunkSizeLocation(x, z), mca.config.chunk.sector.countSize) << mca.config.sector.sizePower;
};

mca.getChunkTimestamp = function(data, x, z)
{
	return data.readUIntBE(getChunkTimestampLocation(x, z), mca.config.chunk.timestampSize);
};

mca.getChunkExactSize = function(data, x, z)
{
	return data.readUIntBE(mca.getChunkLocation(data, x, z), mca.config.chunk.data.byteCountSize) - mca.config.chunk.data.compressionTypeSize;
};

mca.getChunkCompressionType = function(data, x, z)
{
	return mca.compressionTypes[data.readUIntBE(mca.getChunkLocation(data, x, z) + mca.config.chunk.data.byteCountSize, mca.config.chunk.data.compressionTypeSize)];
};

mca.getChunk = function(data, x, z)
{
	var dataStart = mca.getChunkLocation(data, x, z);
	if (dataStart)
	{
		var payloadStart = dataStart + mca.config.chunk.data.detailsSize;
		var payloadEnd = mca.getChunkExactSize(data, x, z) + payloadStart;
		var payload = data.slice(payloadStart, payloadEnd);
		return nbt.read(mca.getChunkCompressionType(data, x, z).decompressSync(payload));
	}
};