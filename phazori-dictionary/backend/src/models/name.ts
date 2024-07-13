import mongoose, { Document, Schema } from 'mongoose';

export interface IName extends Document {
    raiz_phazori: string;
    comun: string;
    notas: string;
}

const nameSchema: Schema = new Schema({
    raiz_phazori: { type: String, required: true },
    comun: { type: String, required: true },
    notas: { type: String, required: false },
});

// Create a compound index on the english and spanish fields
nameSchema.index({ raiz_phazori: 1, comun: 1 }, { unique: true });

// Create the model from the schema and export it
const Name = mongoose.model<IName>('Name', nameSchema);

export default Name;