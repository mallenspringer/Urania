import type { Validator } from "./validationTypes";
import { coreValidator } from "./validators/coreValidator";
import { geometryValidator } from "./validators/geometryValidator";
import { fabricationValidator } from "./validators/fabricationValidator";

class Registry {
  private validators = new Map<string, Validator>();

  register(validator: Validator) {
    this.validators.set(validator.id, validator);
  }

  unregister(id: string) {
    this.validators.delete(id);
  }

  getValidator(id: string): Validator | undefined {
    return this.validators.get(id);
  }

  getAllValidators(): Validator[] {
    return Array.from(this.validators.values());
  }
}

export const validationRegistry = new Registry();

// Register default validators
validationRegistry.register(coreValidator);
validationRegistry.register(geometryValidator);
validationRegistry.register(fabricationValidator);

