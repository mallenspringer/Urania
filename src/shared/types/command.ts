// Base Command Interface for all Project Mutations

export interface Command {
  /**
   * Executes the mutation, updating the project state store.
   */
  execute(): void;

  /**
   * Reverses the mutation, restoring the exact state of the project
   * prior to execution.
   */
  undo(): void;

  /**
   * Exposes a user-facing, localized label describing the operation.
   * Useful for the Undo/Redo history panel lists.
   */
  getLabel(): string;
}
