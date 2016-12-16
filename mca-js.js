var zlib = require('zlib');

var Mca = module.exports = function(data, layout)
{
	this.data = data;
	this.layout = layout || Mca.defaultLayout;
};

Mca.Layout = function(layout)
{
	this.sectorOffsetSize    = 3;
	this.sectorCountSize     = 1;
	this.timestampSize       = 4;
	this.dataSizeSize        = 4;
	this.compressionTypeSize = 1;
	this.dimensionSizePower  = 5;
	this.dimensionCount      = 2;
	this.sectorSizePower     = 12;
	
	for (var propertyName in layout)
	{
		if (layout.hasOwnProperty(propertyName))
		{
			this[propertyName] = layout[propertyName];
		}
	}
};

Mca.Layout.prototype =
{
	constructor: Mca.Layout,
	getIndex: function()
	{
		var index = 0;
		for (var dimension = 0; dimension < this.dimensionCount; dimension++)
		{
			index |= (arguments[dimension] & this.dimensionSizeMask) << dimension * this.dimensionSizePower;
		}
		return index;
	},
	getSectorOffsetOffset: function()
	{
		return this.getIndex.apply(this, arguments) * this.sectorDetailsSize;
	},
	getSectorCountOffset: function()
	{
		return this.getSectorOffsetOffset.apply(this, arguments) + this.sectorOffsetSize;
	},
	getTimestampOffset: function()
	{
		return this.getIndex.apply(this, arguments) * this.timestampSize + this.headerSize;
	}
};

Object.defineProperties(Mca.Layout.prototype,
{
	sectorDetailsSize: { get: function() { return this.sectorOffsetSize + this.sectorCountSize; } },
	dataHeaderSize   : { get: function() { return this.dataSizeSize + this.compressionTypeSize; } },
	dimensionSize    : { get: function() { return 1 << this.dimensionSizePower;                 } },
	dimensionSizeMask: { get: function() { return this.dimensionSize - 1;                       } },
	indexCount       : { get: function() { return this.dimensionSize * this.dimensionCount;     } },
	headerSize       : { get: function() { return this.sectorDetailsSize * this.indexCount;     } },
	sectorSize       : { get: function() { return 1 << this.sectorSizePower;                    } }
});

Mca.defaultLayout = new Mca.Layout();

Mca.compressionTypes =
{
	gzip:
	{
		value         : 1,
		compress      : zlib.gzip,
		compressSync  : zlib.gzipSync,
		decompress    : zlib.gunzip,
		decompressSync: zlib.gunzipSync
	},
	zlib:
	{
		value         : 2,
		compress      : zlib.deflate,
		compressSync  : zlib.deflateSync,
		decompress    : zlib.inflate,
		decompressSync: zlib.inflateSync
	}
};

(function()
{
	for (var compressionTypeName in Mca.compressionTypes)
	{
		if (Mca.compressionTypes.hasOwnProperty(compressionTypeName))
		{
			var compressionType = Mca.compressionTypes[compressionTypeName];
			compressionType.name = compressionTypeName;
			Mca.compressionTypes[compressionType.value] = compressionType;
		}
	}
})();

Mca.prototype =
{
	constructor: Mca,
	getSectorOffset: function()
	{
		return this.data.readUIntBE(this.layout.getSectorOffsetOffset.apply(this.layout, arguments), this.layout.sectorOffsetSize);
	},
	getDataOffset: function()
	{
		return this.getSectorOffset.apply(this, arguments) << this.layout.sectorSizePower;
	},
	getSectorCount: function()
	{
		return this.data.readUIntBE(this.layout.getSectorCountOffset.apply(this.layout, arguments), this.layout.sectorCountSize);
	},
	getTimestamp: function()
	{
		return this.data.readUIntBE(this.layout.getTimestampOffset.apply(this.layout, arguments), this.layout.timestampSize);
	},
	getDataSize: function()
	{
		return this.data.readUIntBE(this.getDataOffset.apply(this, arguments), this.layout.dataSizeSize) - this.layout.compressionTypeSize;
	},
	getCompressionType: function()
	{
		return Mca.compressionTypes[this.data.readUIntBE(this.getDataOffset.apply(this, arguments) + this.layout.dataSizeSize, this.layout.compressionTypeSize)];
	},
	getData: function()
	{
		var dataStart = this.getDataOffset.apply(this, arguments);
		if (dataStart)
		{
			var payloadStart = dataStart + this.layout.dataHeaderSize;
			var payloadEnd = this.getDataSize.apply(this, arguments) + payloadStart;
			var payload = this.data.slice(payloadStart, payloadEnd);
			return this.getCompressionType.apply(this, arguments).decompressSync(payload);
		}
	}
};

Object.getOwnPropertyNames(Mca.prototype).forEach(function(propertyName)
{
	if (propertyName !== 'constructor')
	{
		Mca[propertyName] = function(data)
		{
			var instance = new Mca(data);
			return instance[propertyName].apply(instance, Array.prototype.slice.call(arguments, 1));
		};
	}
});