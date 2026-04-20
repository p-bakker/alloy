import { code, type Children } from "@alloy-js/core";
import {
  Attribute,
  ClosureExpression,
  createTypeRef,
  DocComment,
  EnumDeclaration,
  EnumVariant,
  Field,
  FieldInit,
  FunctionCallExpression,
  FunctionDeclaration,
  IfExpression,
  ImplBlock,
  LetBinding,
  MacroCall,
  MatchArm,
  MatchExpression,
  MethodChainExpression,
  prelude,
  ReturnExpression,
  SourceFile,
  std,
  StructDeclaration,
  StructExpression,
} from "@alloy-js/rust";

import { Config } from "./config-file.js";
import { ResultAlias, StoreError } from "./error-module.js";
import { Cacheable } from "./traits-module.js";

const { Clone, Eq, Err, None, Ok, Option, PartialEq, Send, Sync } = prelude;
const {
  time: { Duration, Instant },
  collections: { HashMap },
  fmt: { Debug },
  hash: { Hash },
} = std;

export const Store = createTypeRef();
export const Entry = createTypeRef();
export const EntryStatus = createTypeRef({
  variants: {
    Active: "unit",
    Expired: "unit",
    Evicted: "unit",
  },
});

export interface StoreModuleProps {
  children?: Children;
}

export function StoreModule(props: StoreModuleProps) {
  return (
    <SourceFile path="store.rs" pub>
      <DocComment>
        {`Core storage engine for the key-value store.\n\nProvides a generic, thread-safe store with support\nfor expiration and capacity limits.`}
      </DocComment>

      <EnumDeclaration
        name="EntryStatus"
        refkey={EntryStatus}
        pub
        derives={[Debug, Clone, PartialEq]}
        doc="Represents the current status of a cached entry."
      >
        <EnumVariant
          name="Active"
          refkey={EntryStatus.Active}
          doc="The entry is valid and accessible."
        />
        <EnumVariant
          name="Expired"
          refkey={EntryStatus.Expired}
          doc="The entry has passed its time-to-live."
        />
        <EnumVariant
          name="Evicted"
          refkey={EntryStatus.Evicted}
          doc="The entry was removed to make room for new entries."
        />
      </EnumDeclaration>

      <hbr />

      <StructDeclaration
        name="Entry"
        refkey={Entry}
        pub
        derives={[Debug, Clone]}
        typeParameters={[{ name: "V", constraints: Clone }]}
        doc="A single entry in the store, holding a value and metadata."
      >
        <Field name="value" pub type="V" />
        <Field name="created_at" pub type={Instant} />
        <Field name="ttl" pub type={<Option>{Duration}</Option>} />
        <Field name="status" pub type={EntryStatus} />
      </StructDeclaration>

      <hbr />

      <StructDeclaration
        name="Store"
        refkey={Store}
        pub
        typeParameters={[
          {
            name: "K",
            constraints: code`${Eq} + ${Hash} + ${Clone}`,
          },
          {
            name: "V",
            constraints: code`${Clone} + ${Send} + ${Sync}`,
          },
        ]}
        doc="A generic key-value store with capacity limits and TTL support."
      >
        <Field
          name="data"
          type={
            <HashMap>
              K, <Entry>V</Entry>
            </HashMap>
          }
        />
        <Field name="max_capacity" type="usize" />
        <Field name="default_ttl" type={<Option>{Duration}</Option>} />
      </StructDeclaration>

      <hbr />

      <ImplBlock
        type={Store}
        typeParameters={[
          {
            name: "K",
            constraints: code`${Eq} + ${Hash} + ${Clone}`,
          },
          {
            name: "V",
            constraints: code`${Clone} + ${Send} + ${Sync}`,
          },
        ]}
      >
        <DocComment>
          Creates a new store from the given configuration.
        </DocComment>
        <FunctionDeclaration
          name="new"
          pub
          receiver="none"
          parameters={[{ name: "config", type: Config }]}
          returnType="Self"
        >
          <StructExpression type="Self">
            <FieldInit name="data">
              <FunctionCallExpression target={HashMap.new} />
            </FieldInit>
            <FieldInit name="max_capacity">config.max_capacity</FieldInit>
            <FieldInit name="default_ttl">config.default_ttl</FieldInit>
          </StructExpression>
        </FunctionDeclaration>

        <DocComment>
          Inserts a value into the store, returning an error if full.
        </DocComment>
        <FunctionDeclaration
          name="insert"
          pub
          receiver="&mut self"
          parameters={[
            { name: "key", type: "K" },
            { name: "value", type: "V" },
          ]}
          returnType={<ResultAlias>{"()"}</ResultAlias>}
        >
          <IfExpression condition="self.data.len() >= self.max_capacity && !self.data.contains_key(&key)">
            <ReturnExpression>
              <Err>
                <StoreError.StorageFull />
              </Err>
            </ReturnExpression>
          </IfExpression>
          <hbr />
          <LetBinding name="entry">
            <StructExpression type="Entry">
              <FieldInit name="value" />
              <FieldInit name="created_at">
                <FunctionCallExpression target={Instant.now} />
              </FieldInit>
              <FieldInit name="ttl">self.default_ttl</FieldInit>
              <FieldInit name="status">
                <EntryStatus.Active />
              </FieldInit>
            </StructExpression>
          </LetBinding>
          <hbr />
          {code`self.data.insert(key, entry);`}
          <hbr />
          <Ok>{"()"}</Ok>
        </FunctionDeclaration>

        <DocComment>
          Retrieves a value by key, checking for expiration.
        </DocComment>
        <FunctionDeclaration
          name="get"
          pub
          receiver="&self"
          parameters={[{ name: "key", type: "&K" }]}
          returnType={<ResultAlias>&amp;V</ResultAlias>}
        >
          <MatchExpression expression="self.data.get(key)">
            <MatchArm pattern="Some(entry)">
              <IfExpression
                condition={code`entry.status == ${EntryStatus.Expired}`}
              >
                <ReturnExpression>
                  <Err>
                    <StoreError.NotFound />
                  </Err>
                </ReturnExpression>
              </IfExpression>
              <IfExpression condition="let Some(ttl) = entry.ttl">
                <IfExpression condition="entry.created_at.elapsed() &gt; ttl">
                  <ReturnExpression>
                    <Err>
                      <StoreError.NotFound />
                    </Err>
                  </ReturnExpression>
                </IfExpression>
              </IfExpression>
              <Ok>&amp;entry.value</Ok>
            </MatchArm>
            <MatchArm pattern="None">
              <Err>
                <StoreError.NotFound />
              </Err>
            </MatchArm>
          </MatchExpression>
        </FunctionDeclaration>

        <DocComment>Removes an entry from the store.</DocComment>
        <FunctionDeclaration
          name="remove"
          pub
          receiver="&mut self"
          parameters={[{ name: "key", type: "&K" }]}
          returnType={<ResultAlias>V</ResultAlias>}
        >
          <MethodChainExpression receiver="self.data">
            <MethodChainExpression.Call name="remove" args={["key"]} />
            <MethodChainExpression.Call
              name="map"
              args={[
                <ClosureExpression parameters={[{ name: "entry" }]}>
                  entry.value
                </ClosureExpression>,
              ]}
            />
            <MethodChainExpression.Call
              name="ok_or"
              args={[StoreError.NotFound]}
            />
          </MethodChainExpression>
        </FunctionDeclaration>

        <DocComment>Returns the number of entries in the store.</DocComment>
        <Attribute name="inline" />
        <FunctionDeclaration name="len" pub receiver="&self" returnType="usize">
          self.data.len()
        </FunctionDeclaration>

        <DocComment>Returns true if the store is empty.</DocComment>
        <Attribute name="inline" />
        <FunctionDeclaration
          name="is_empty"
          pub
          receiver="&self"
          returnType="bool"
        >
          self.data.is_empty()
        </FunctionDeclaration>

        <DocComment>Evicts all expired entries from the store.</DocComment>
        <FunctionDeclaration
          name="evict_expired"
          pub
          receiver="&mut self"
          returnType="usize"
        >
          <LetBinding name="before">self.data.len()</LetBinding>
          <hbr />
          {code`
            self.data.retain(|_, entry| {
                if let Some(ttl) = entry.ttl {
                    entry.created_at.elapsed() <= ttl
                } else {
                    true
                }
            });
          `}
          <hbr />
          {code`before - self.data.len()`}
        </FunctionDeclaration>
      </ImplBlock>

      <hbr />

      <ImplBlock
        type={Store}
        trait={<Cacheable>V</Cacheable>}
        typeParameters={[
          {
            name: "K",
            constraints: code`${Eq} + ${Hash} + ${Clone}`,
          },
          {
            name: "V",
            constraints: code`${Clone} + ${Send} + ${Sync}`,
          },
        ]}
      >
        <FunctionDeclaration
          name="cache_key"
          receiver="&self"
          returnType="String"
        >
          <MacroCall name="format" args={['"store::{}"', "self.data.len()"]} />
        </FunctionDeclaration>

        <FunctionDeclaration
          name="is_expired"
          receiver="&self"
          returnType="bool"
        >
          self.data.is_empty()
        </FunctionDeclaration>

        <FunctionDeclaration
          name="cached_value"
          receiver="&self"
          returnType={<Option>&amp;V</Option>}
        >
          <None />
        </FunctionDeclaration>
      </ImplBlock>
    </SourceFile>
  );
}
