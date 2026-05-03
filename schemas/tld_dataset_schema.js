var mongoose = require("mongoose");

var tld_dataset_schema = new mongoose.Schema(
  {
    tld: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true
    },
    unicode_tld: {
      type: String,
      default: null,
      trim: true
    },
    source: {
      type: String,
      required: true,
      default: "iana",
      trim: true,
      lowercase: true,
      index: true
    },
    source_url: {
      type: String,
      default: null,
      trim: true
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true
    },
    fetched_at: {
      type: Date,
      default: Date.now,
      index: true
    },
    last_seen_at: {
      type: Date,
      default: Date.now,
      index: true
    },
    raw_line: {
      type: String,
      default: null
    },
    notes: {
      type: String,
      default: null
    }
  },
  {
    versionKey: false,
    timestamps: true,
    collection: "tld_dataset"
  }
);

tld_dataset_schema.index({ tld: 1 }, { unique: true });
tld_dataset_schema.index({ is_active: 1, tld: 1 });

module.exports = mongoose.model("tld_dataset", tld_dataset_schema);