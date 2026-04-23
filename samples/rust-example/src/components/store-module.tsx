import { Children, code, refkey } from "@alloy-js/core";
import {
  Attribute,
  ClosureExpression,
  DocComment,
  EnumDeclaration,
  EnumVariant,
  Field,
  FieldInit,
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

import { configKey } from "./config-file.js";
import { resultAliasKey, storeErrorKey } from "./error-module.js";
import { cacheableKey } from "./traits-module.js";

export const storeKey = refkey();
export const entryKey = refkey();
export const entryStatusKey = refkey();

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
        refkey={entryStatusKey}
        pub
        derives={[std.fmt.Debug, prelude.Clone, prelude.PartialEq]}
        doc="Represents the current status of a cached entry."
      >
        <EnumVariant name="Active" doc="The entry is valid and accessible." />
        <EnumVariant
          name="Expired"
          doc="The entry has passed its time-to-live."
        />
        <EnumVariant
          name="Evicted"
          doc="The entry was removed to make room for new entries."
        />
      </EnumDeclaration>

      <hbr />

      <StructDeclaration
        name="Entry"
        refkey={entryKey}
        pub
        derives={[std.fmt.Debug, prelude.Clone]}
        typeParameters={[{ name: "V", constraint: prelude.Clone }]}
        doc="A single entry in the store, holding a value and metadata."
      >
        <Field name="value" pub type="V" />
        <Field name="created_at" pub type={std.time.Instant} />
        <Field
          name="ttl"
          pub
          type={
            <>
              {"Option<"}
              {std.time.Duration}
              {">"}
            </>
          }
        />
        <Field name="status" pub type="EntryStatus" />
      </StructDeclaration>

      <hbr />

      <StructDeclaration
        name="Store"
        refkey={storeKey}
        pub
        typeParameters={[
          {
            name: "K",
            constraint: (
              <>
                {prelude.Eq} + {std.hash.Hash} + {prelude.Clone}
              </>
            ),
          },
          {
            name: "V",
            constraint: (
              <>
                {prelude.Clone} + {prelude.Send} + {prelude.Sync}
              </>
            ),
          },
        ]}
        doc="A generic key-value store with capacity limits and TTL support."
      >
        <Field
          name="data"
          type={
            <>
              {std.collections.HashMap}
              {"<K, Entry<V>>"}
            </>
          }
        />
        <Field name="max_capacity" type="usize" />
        <Field
          name="default_ttl"
          type={
            <>
              {"Option<"}
              {std.time.Duration}
              {">"}
            </>
          }
        />
      </StructDeclaration>

      <hbr />

      <ImplBlock
        type={storeKey}
        typeParameters={[
          {
            name: "K",
            constraint: (
              <>
                {prelude.Eq} + {std.hash.Hash} + {prelude.Clone}
              </>
            ),
          },
          {
            name: "V",
            constraint: (
              <>
                {prelude.Clone} + {prelude.Send} + {prelude.Sync}
              </>
            ),
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
          parameters={[{ name: "config", type: configKey }]}
          returnType="Self"
        >
          <StructExpression type="Self">
            <FieldInit name="data">{std.collections.HashMap}::new()</FieldInit>
            <FieldInit name="max_capacity">config.max_capacity</FieldInit>
            <FieldInit name="default_ttl">config.default_ttl</FieldInit>
          </StructExpression>
        </FunctionDeclaration>

        <hbr />

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
          returnType={
            <>
              {resultAliasKey}
              {"<()>"}
            </>
          }
        >
          <IfExpression condition="self.data.len() >= self.max_capacity && !self.data.contains_key(&key)">
            <>
              <ReturnExpression>Err(StoreError::StorageFull)</ReturnExpression>;
            </>
          </IfExpression>
          <LetBinding name="entry">
            <StructExpression type="Entry">
              <FieldInit name="value" />
              <FieldInit name="created_at">{std.time.Instant}::now()</FieldInit>
              <FieldInit name="ttl">self.default_ttl</FieldInit>
              <FieldInit name="status">EntryStatus::Active</FieldInit>
            </StructExpression>
          </LetBinding>
          self.data.insert(key, entry); Ok(())
        </FunctionDeclaration>

        <hbr />

        <DocComment>
          Retrieves a value by key, checking for expiration.
        </DocComment>
        <FunctionDeclaration
          name="get"
          pub
          receiver="&self"
          parameters={[{ name: "key", type: "&K" }]}
          returnType={
            <>
              {resultAliasKey}
              {"<&V>"}
            </>
          }
        >
          <MatchExpression expression="self.data.get(key)">
            <MatchArm pattern="Some(entry)">
              <IfExpression condition="entry.status == EntryStatus::Expired">
                <>
                  <ReturnExpression>Err(StoreError::NotFound)</ReturnExpression>
                  ;
                </>
              </IfExpression>
              <IfExpression condition="let Some(ttl) = entry.ttl">
                <IfExpression condition="entry.created_at.elapsed() &gt; ttl">
                  <>
                    <ReturnExpression>
                      Err(StoreError::NotFound)
                    </ReturnExpression>
                    ;
                  </>
                </IfExpression>
              </IfExpression>
              Ok(&entry.value)
            </MatchArm>
            <MatchArm pattern="None">Err(StoreError::NotFound)</MatchArm>
          </MatchExpression>
        </FunctionDeclaration>

        <hbr />

        <DocComment>Removes an entry from the store.</DocComment>
        <FunctionDeclaration
          name="remove"
          pub
          receiver="&mut self"
          parameters={[{ name: "key", type: "&K" }]}
          returnType={
            <>
              {resultAliasKey}
              {"<V>"}
            </>
          }
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
              args={[<>{storeErrorKey}::NotFound</>]}
            />
          </MethodChainExpression>
        </FunctionDeclaration>

        <hbr />

        <DocComment>Returns the number of entries in the store.</DocComment>
        <FunctionDeclaration
          name="len"
          pub
          receiver="&self"
          returnType="usize"
          attributes={[<Attribute name="inline" />]}
        >
          self.data.len()
        </FunctionDeclaration>

        <hbr />

        <DocComment>Returns true if the store is empty.</DocComment>
        <FunctionDeclaration
          name="is_empty"
          pub
          receiver="&self"
          returnType="bool"
          attributes={[<Attribute name="inline" />]}
        >
          self.data.is_empty()
        </FunctionDeclaration>

        <hbr />

        <DocComment>Evicts all expired entries from the store.</DocComment>
        <FunctionDeclaration
          name="evict_expired"
          pub
          receiver="&mut self"
          returnType="usize"
        >
          <LetBinding name="before">self.data.len()</LetBinding>
          {code`self.data.retain(|_, entry| {
                if let Some(ttl) = entry.ttl {
                    entry.created_at.elapsed() <= ttl
                } else {
                    true
                }
            });`}
          before - self.data.len()
        </FunctionDeclaration>
      </ImplBlock>

      <hbr />

      <ImplBlock
        type={storeKey}
        trait={
          <>
            {cacheableKey}
            {"<V>"}
          </>
        }
        typeParameters={[
          {
            name: "K",
            constraint: (
              <>
                {prelude.Eq} + {std.hash.Hash} + {prelude.Clone}
              </>
            ),
          },
          {
            name: "V",
            constraint: (
              <>
                {prelude.Clone} + {prelude.Send} + {prelude.Sync}
              </>
            ),
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

        <hbr />

        <FunctionDeclaration
          name="is_expired"
          receiver="&self"
          returnType="bool"
        >
          self.data.is_empty()
        </FunctionDeclaration>

        <hbr />

        <FunctionDeclaration
          name="cached_value"
          receiver="&self"
          returnType="Option<&V>"
        >
          None
        </FunctionDeclaration>
      </ImplBlock>
    </SourceFile>
  );
}
