import mongoose from 'mongoose';

const FavouriteSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      index:    true,
    },
    name:      { type: String, required: true, trim: true, minlength: 1 },
    address:   { type: String, default: '',    trim: true },
    latitude:  { type: Number, required: true, min: -90,  max: 90  },
    longitude: { type: Number, required: true, min: -180, max: 180 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

FavouriteSchema.index({ userId: 1, name: 1 }, { unique: true });

export const Favourite = mongoose.model('Favourite', FavouriteSchema);
