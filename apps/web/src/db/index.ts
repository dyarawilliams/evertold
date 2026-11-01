import { Dexie } from "dexie";

/**
 * Browser database for EverTold.
 * Tables are added with the features that need them. Version 1 is intentionally empty.
 */
export class EverToldDatabase extends Dexie {
  constructor() {
    super("evertold");
    this.version(1).stores({});
  }
}

export const db = new EverToldDatabase();
