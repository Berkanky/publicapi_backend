var mongoose = require("mongoose");

var disposable_email_domain_schema = new mongoose.Schema(
  {
    domain: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true
    },
    registrable_domain: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      index: true
    },
    sources: [
      {
        source_name: {
          type: String,
          required: true,
          trim: true,
          lowercase: true
        },
        source_url: {
          type: String,
          default: null,
          trim: true
        },
        fetched_at: {
          type: Date,
          default: Date.now
        },
        last_seen_at: {
          type: Date,
          default: Date.now
        }
      }
    ],
    source_count: {
      type: Number,
      default: 1,
      min: 0,
      index: true
    },
    confidence_score: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
      index: true
    },
    category: {
      type: String,
      default: "disposable",
      trim: true,
      lowercase: true,
      index: true
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true
    },
    first_seen_at: {
      type: Date,
      default: Date.now,
      index: true
    },
    last_seen_at: {
      type: Date,
      default: Date.now,
      index: true
    },
    notes: {
      type: String,
      default: null
    }
  },
  {
    versionKey: false,
    timestamps: true,
    collection: "disposable_email_domains"
  }
);

disposable_email_domain_schema.index({ domain: 1 }, { unique: true });
disposable_email_domain_schema.index({ is_active: 1, domain: 1 });
disposable_email_domain_schema.index({ category: 1, is_active: 1 });
disposable_email_domain_schema.index({ source_count: -1, confidence_score: -1 });

module.exports = mongoose.model("disposable_email_domain", disposable_email_domain_schema);