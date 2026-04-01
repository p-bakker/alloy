import "@typespec/http";

using TypeSpec.Http;

namespace PetStore;

/** A pet in the store */
model Pet {
  /** Unique identifier */
  @key id: uint64;

  /** The pet's name */
  @minLength(1)
  @maxLength(100)
  name: string;

  /** Age in years */
  @minValue(0)
  @maxValue(30)
  age?: int32;

  /** The pet's species */
  species: Species;

  /** Pet's email for notifications */
  @format("email")
  email?: string;

  storeId: Store.id;
}

/** Available species */
enum Species {
  Dog,
  Cat,
  Bird,
  Fish,
}

model Store {
  @key id: int32;
}

/** Request to create a new pet */
model CreatePetRequest {
  @minLength(1)
  name: string;

  species: Species;

  @minValue(0)
  age?: int32;
}

/** A user of the pet store */
model User {
  @key id: uint64;

  @format("email")
  email: string;

  @minItems(1)
  pets: Pet[];
}

/** Named union for pet status */
union PetStatus {
  available: "available",
  pending: "pending",
  sold: "sold",
}

/** Pet store service operations */
@route("/pets")
interface PetService {
  /** Create a new pet */
  @post create(request: CreatePetRequest): Pet;

  /** Get a pet by ID */
  @get read(@path id: uint64): Pet;

  /** List all pets */
  @get list(): Pet[];
}
