import { refkey, type Children } from "@alloy-js/core";
import {
  Attribute,
  ConstDeclaration,
  createTypeRef,
  DocComment,
  Field,
  FieldInit,
  FunctionCallExpression,
  FunctionDeclaration,
  ImplBlock,
  prelude,
  SourceFile,
  std,
  StructDeclaration,
  StructExpression,
} from "@alloy-js/rust";

const { Clone, Option, Some } = prelude;
const {
  time: { Duration },
  fmt: { Debug },
} = std;

export const Config = createTypeRef();
export const maxEntriesKey = refkey();
export const defaultTtlSecsKey = refkey();

export interface ConfigFileProps {
  children?: Children;
}

export function ConfigFile(props: ConfigFileProps) {
  return (
    <SourceFile path="config.rs" pub>
      <DocComment>Configuration for the key-value store.</DocComment>

      <ConstDeclaration
        name="MAX_ENTRIES"
        refkey={maxEntriesKey}
        pub
        type="usize"
      >
        10_000
      </ConstDeclaration>

      <hbr />

      <ConstDeclaration
        name="DEFAULT_TTL_SECS"
        refkey={defaultTtlSecsKey}
        pub
        type="u64"
      >
        3600
      </ConstDeclaration>

      <hbr />

      <DocComment>
        {`Configuration options for initializing a Store.\n\nUse the builder methods to customize behavior.`}
      </DocComment>
      <StructDeclaration
        name="Config"
        refkey={Config}
        pub
        derives={[Debug, Clone]}
      >
        <Field name="max_capacity" pub type="usize" />
        <Field name="default_ttl" pub type={<Option>{Duration}</Option>} />
        <Field name="enable_eviction" pub type="bool" />
        <Field name="name" pub type="String" />
      </StructDeclaration>

      <hbr />

      <ImplBlock type={Config}>
        <DocComment>Creates a new Config with sensible defaults.</DocComment>
        <FunctionDeclaration name="new" pub receiver="none" returnType="Self">
          <StructExpression type="Self">
            <FieldInit name="max_capacity">MAX_ENTRIES</FieldInit>
            <FieldInit name="default_ttl">
              <Some>
                <FunctionCallExpression
                  target={Duration.from_secs}
                  args={[defaultTtlSecsKey]}
                />
              </Some>
            </FieldInit>
            <FieldInit name="enable_eviction">true</FieldInit>
            <FieldInit name="name">String::from("default")</FieldInit>
          </StructExpression>
        </FunctionDeclaration>

        <DocComment>Sets the maximum number of entries.</DocComment>
        <FunctionDeclaration
          name="with_max_capacity"
          pub
          receiver="self"
          parameters={[{ name: "capacity", type: "usize" }]}
          returnType="Self"
          attributes={[<Attribute name="must_use" />]}
        >
          <StructExpression type="Self" spread="self">
            <FieldInit name="max_capacity">capacity</FieldInit>
          </StructExpression>
        </FunctionDeclaration>

        <DocComment>Sets the default TTL for entries.</DocComment>
        <FunctionDeclaration
          name="with_ttl"
          pub
          receiver="self"
          parameters={[{ name: "ttl", type: Duration }]}
          returnType="Self"
          attributes={[<Attribute name="must_use" />]}
        >
          <StructExpression type="Self" spread="self">
            <FieldInit name="default_ttl">
              <Some>ttl</Some>
            </FieldInit>
          </StructExpression>
        </FunctionDeclaration>

        <DocComment>Disables automatic eviction of expired entries.</DocComment>
        <FunctionDeclaration
          name="disable_eviction"
          pub
          receiver="self"
          returnType="Self"
          attributes={[<Attribute name="must_use" />]}
        >
          <StructExpression type="Self" spread="self">
            <FieldInit name="enable_eviction">false</FieldInit>
          </StructExpression>
        </FunctionDeclaration>

        <DocComment>Sets the name of this store instance.</DocComment>
        <FunctionDeclaration
          name="with_name"
          pub
          receiver="self"
          parameters={[{ name: "name", type: "&str" }]}
          returnType="Self"
          attributes={[<Attribute name="must_use" />]}
        >
          <StructExpression type="Self" spread="self">
            <FieldInit name="name">name.to_owned()</FieldInit>
          </StructExpression>
        </FunctionDeclaration>
      </ImplBlock>
    </SourceFile>
  );
}
