import mongoose from 'mongoose';

/**
 * User account.
 *
 * Notes:
 *   - The password is stored as a bcrypt hash in `passwordHash`. We never
 *     store the plain password.
 *   - Email is the natural login identifier so it must be unique. We
 *     lowercase + trim it on save to avoid duplicate accounts that differ
 *     only in case ("alice@x.com" vs "Alice@X.com").
 *   - The `toJSON` transform strips passwordHash and _id from any response,
 *     so we can safely `res.json(user)` without leaking secrets.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, minlength: 1 },
    lastName:  { type: String, required: true, trim: true, minlength: 1 },
    email: {
      type:      String,
      required:  true,
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [EMAIL_REGEX, 'Invalid email format'],
    },
    passwordHash: { type: String, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

export const User = mongoose.model('User', UserSchema);
