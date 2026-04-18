//! A generic, thread-safe key-value store library.
//!
//! This crate provides a configurable in-memory store
//! with support for TTL-based expiration, capacity limits,
//! and trait-based extensibility.

pub mod config;
pub mod error;
pub mod store;
pub mod traits;
