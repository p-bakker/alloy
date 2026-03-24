import { Output, render, memberRefkey, refkey, code } from "@alloy-js/core";
import { describe, expect, it } from "vitest";
import { findFile } from "../../../test/utils.js";
import { CrateDirectory } from "../CrateDirectory.js";
import { SourceDirectory } from "../SourceDirectory.js";
import { SourceFile } from "../SourceFile.js";
import { StructDeclaration, StructField } from "./declaration.js";
import { FunctionDeclaration } from "../function/function.js";

describe("memberRefkey", () => {
  it("disambiguates field references across structs with same field names", () => {
    const personKey = refkey("Person");
    const petKey = refkey("Pet");
    const personNameKey = refkey("Person", "name");
    const petNameKey = refkey("Pet", "name");

    const res = render(
      <Output>
        <CrateDirectory name="test-crate">
          <SourceDirectory path=".">
            <SourceFile path="models.rs">
              <StructDeclaration name="Person" refkey={personKey} visibility="pub">
                <StructField name="name" type="String" refkey={personNameKey} visibility="pub" />
              </StructDeclaration>
              <hbr />
              <hbr />
              <StructDeclaration name="Pet" refkey={petKey} visibility="pub">
                <StructField name="name" type="String" refkey={petNameKey} visibility="pub" />
              </StructDeclaration>
            </SourceFile>

            <SourceFile path="lib.rs">
              <FunctionDeclaration
                name="get_person_name"
                visibility="pub"
                returns="String"
              >
                {code`let val = ${memberRefkey(personKey, "name")};`}
              </FunctionDeclaration>
            </SourceFile>
          </SourceDirectory>
        </CrateDirectory>
      </Output>,
    );

    // The memberRefkey resolves to the full qualified path: Person::name.
    // The lexicalDeclaration is the struct (Person), and the memberPath
    // contains the field symbol. The ref() function joins all path members
    // with "::", producing "Person::name".
    const libContents = findFile(res, "lib.rs").contents;
    // memberRefkey resolves to the qualified path: Person::name
    expect(libContents).toContain("Person::name");
    // A use statement is generated for the struct (importable declaration),
    // since the struct is defined in a different file
    expect(libContents).toContain("use crate::models::Person;");
    // No use statement for the field itself — fields are not importable
    expect(libContents).not.toContain("use crate::models::name");
    // The models.rs file should contain both structs
    const modelsContents = findFile(res, "models.rs").contents;
    expect(modelsContents).toContain("pub struct Person");
    expect(modelsContents).toContain("pub struct Pet");
  });

  it("resolves memberRefkey to the correct field name within the same file", () => {
    const personKey = refkey("PersonSameFile");
    const personNameKey = refkey("PersonSameFile", "name");
    const petKey = refkey("PetSameFile");
    const petNameKey = refkey("PetSameFile", "name");

    const res = render(
      <Output>
        <CrateDirectory name="test-crate">
          <SourceDirectory path=".">
            <SourceFile path="lib.rs">
              <StructDeclaration name="Person" refkey={personKey} visibility="pub">
                <StructField name="name" type="String" refkey={personNameKey} visibility="pub" />
              </StructDeclaration>
              <hbr />
              <hbr />
              <StructDeclaration name="Pet" refkey={petKey} visibility="pub">
                <StructField name="name" type="String" refkey={petNameKey} visibility="pub" />
              </StructDeclaration>
              <hbr />
              <hbr />
              <FunctionDeclaration
                name="get_person_name"
                visibility="pub"
                returns="String"
              >
                {code`let person_name = ${memberRefkey(personKey, "name")};`}
                <hbr />
                {code`let pet_name = ${memberRefkey(petKey, "name")};`}
              </FunctionDeclaration>
            </SourceFile>
          </SourceDirectory>
        </CrateDirectory>
      </Output>,
    );

    const libContents = findFile(res, "lib.rs").contents;
    // memberRefkey resolves to the qualified path: StructName::field_name.
    // This disambiguates which struct's "name" field is being referenced.
    expect(libContents).toContain("person_name = Person::name");
    expect(libContents).toContain("pet_name = Pet::name");
    // No use statements should be generated since everything is in the same file
    expect(libContents).not.toContain("use ");
  });

  it("resolves memberRefkey with refkey-based member (not string)", () => {
    const personKey = refkey("PersonRefkeyMember");
    const nameFieldKey = refkey("PersonRefkeyMember", "nameField");

    const res = render(
      <Output>
        <CrateDirectory name="test-crate">
          <SourceDirectory path=".">
            <SourceFile path="lib.rs">
              <StructDeclaration name="Person" refkey={personKey} visibility="pub">
                <StructField name="name" type="String" refkey={nameFieldKey} visibility="pub" />
              </StructDeclaration>
              <hbr />
              <hbr />
              <FunctionDeclaration
                name="get_name"
                visibility="pub"
                returns="String"
              >
                {code`let val = ${memberRefkey(personKey, nameFieldKey)};`}
              </FunctionDeclaration>
            </SourceFile>
          </SourceDirectory>
        </CrateDirectory>
      </Output>,
    );

    const libContents = findFile(res, "lib.rs").contents;
    // Using a refkey-based member also resolves to the qualified path
    expect(libContents).toContain("val = Person::name");
    expect(libContents).not.toContain("use ");
  });
});
