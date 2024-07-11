import mongoose, { Document, Schema } from 'mongoose';

export interface IName extends Document {
    raiz_phazori: string;
    comun: string;
    significado: string;
    regular: boolean;
    masculino: string;
    femenino: string;
}

const nameSchema: Schema = new Schema({
    raiz_phazori: { type: String, required: true },
    comun: { type: String, required: true },
    significado: { type: String, required: false },
    regular: { type: Boolean, required: true },
    masculino: { type: String, required: false },
    femenino: { type: String, required: false },
});

// Create a compound index on the english and spanish fields
nameSchema.index({ raiz_phazori: 1, comun: 1 }, { unique: true });

// Create the model from the schema and export it
const Name = mongoose.model<IName>('Name', nameSchema);

export default Name;