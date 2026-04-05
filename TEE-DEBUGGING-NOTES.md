# TEE Integration Debugging Notes

All issues encountered and fixed while integrating the FlareScore TEE credit score extension on Coston2.

---

## 1. ECIES Encryption Mismatch (Frontend → TEE Decryption Failed)

**Symptom:** `error: decryption failed: Error: node returned 400: can not decrypt`

**Root cause:** The frontend's JavaScript ECIES implementation didn't match Go's `ecies.ECIES_AES128_SHA256` from `go-ethereum/crypto/ecies`.

**Three bugs in the JS ECIES:**

| Bug | Wrong | Correct |
|-----|-------|---------|
| KDF output length | `concatKDF(sharedX, 32)` → 16 enc + 16 mac | `concatKDF(sharedX, 32)` → 16 enc + 16 mac, then SHA-256 the mac half to get 32-byte mac key |
| MAC key derivation | Either no hash or double hash | Go does `Km = SHA256(rawMacBytes)` — exactly one hash of the 16-byte KDF tail |
| IV handling | Zero IV (`new Uint8Array(16)`) | Random 16-byte IV, **prepended** to ciphertext |

**Go's actual ECIES format:**
```
[65 bytes] Ephemeral uncompressed public key (04 || X || Y)
[16 bytes] Random IV
[N bytes]  AES-128-CTR ciphertext
[32 bytes] HMAC-SHA-256 tag (over IV + ciphertext)
```

**Key source:** `go-ethereum@v1.16.7/crypto/ecies/ecies.go` — `deriveKeys()`, `symEncrypt()`, `messageTag()`.

---

## 2. EIP-191 Signature Prefix — Double/Triple Application

**Symptom:** `ECDSAInvalidSignature` revert when calling `CreditVault.receiveScore()`

**Root cause:** Misunderstanding the TEE node's `/sign` endpoint internals.

The `/sign` endpoint does **two** things internally:
1. `msgHash = keccak256(input)` — hashes whatever you send
2. `crypto.Sign(accounts.TextHash(msgHash), privateKey)` — applies EIP-191 prefix (`\x19Ethereum Signed Message:\n32` + hash), then keccak256, then ECDSA signs

The contract does:
```solidity
bytes32 messageHash = keccak256(abi.encodePacked(user, score, timestamp));
bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
// toEthSignedMessageHash = keccak256("\x19Ethereum Signed Message:\n32" + messageHash)
address recovered = ECDSA.recover(ethSignedHash, sig);
```

**What to send to `/sign`:** The raw `abi.encodePacked(user, score, timestamp)` bytes (NOT the hash).

Then the chain is:
1. `/sign` hashes it → `keccak256(packed)` = same as contract's `messageHash`
2. `accounts.TextHash` adds EIP-191 → same as contract's `toEthSignedMessageHash`
3. Signs → matches what `ECDSA.recover` expects

**Wrong approaches we tried:**
- Sending `keccak256(packed)` → `/sign` hashes again → double keccak256
- Sending EIP-191 prefixed bytes → `/sign` hashes, then `TextHash` adds prefix again → triple wrapped

---

## 3. Signature V-Value: 0/1 vs 27/28

**Symptom:** `ECDSAInvalidSignature` — signature format correct but `ecrecover` returns `address(0)`

**Root cause:** Go's `crypto.Sign` returns the recovery ID (v) as 0 or 1. Solidity's `ecrecover` precompile requires v = 27 or 28.

**Fix in the TEE handler's `signViaNode`:**
```typescript
if (sigBytes.length === 65 && sigBytes[64] < 27) {
  sigBytes[64] += 27;
}
```

---

## 4. Dead TEE Machines — Random Routing to Offline Nodes

**Symptom:** Instructions sent on-chain but never processed. Proxy returns 404 indefinitely. Works ~25% of the time.

**Root cause:** Every Docker restart generates a new TEE keypair and registers a new machine. Old machines remain "active" in the `TeeMachineRegistry`. The `getRandomTeeIds()` function picks randomly among ALL active machines for that extension.

With 4 registered machines (3 dead + 1 alive), there's a 75% chance the instruction gets routed to a dead machine that will never process it.

**How to verify:**
```bash
cast call $TEE_MACHINE_REGISTRY "getActiveTeeMachines(uint256)(address[],string[])" $EXTENSION_ID --rpc-url $RPC
```

**Fix:** Deploy a fresh `InstructionSender` + register a new extension before each Docker restart. This ensures only 1 machine exists for the new extension. The registry doesn't support deregistration.

**Deployment checklist after each Docker restart:**
1. `forge create InstructionSender` → new contract
2. `go run ./cmd/register-extension` → new extension ID
3. `cast send $NEW_IS "setExtensionId()"` → link contract to extension
4. Update `.env` files (tee + frontend)
5. `docker compose up -d`
6. `go run ./cmd/allow-tee-version`
7. `go run ./cmd/register-tee -l`
8. `cast send CreditVault "setTeeSigner(address)" $TEE_ADDR`

---

## 5. Future Timestamp Revert

**Symptom:** `CreditVault: future timestamp` revert on `receiveScore()`

**Root cause:** The TEE container's `Date.now()` can be a few seconds ahead of Coston2's `block.timestamp`. The contract requires `timestamp <= block.timestamp`.

**Fix:** Subtract a 5-second buffer:
```typescript
const timestamp = Math.floor(Date.now() / 1000) - 5;
```

---

## 6. Plaid API Timeout Inside TEE

**Symptom:** `extension error: context deadline exceeded` — TEE computes the score but the response arrives after the tee-node's ~2s timeout.

**Root cause:** The TEE node has a short HTTP timeout (~2s) when calling the extension's `/action` endpoint. Two sequential Plaid API calls (balance + transactions) exceeded this.

**Fix:** 
- Run both Plaid calls in parallel (`Promise.all`)
- Add a 1.5s timeout with sandbox fallback data
- If Plaid is too slow, mock data is used (acceptable for hackathon demo)

---

## 7. Missing `return` in InstructionSender.requestCreditScore

**Symptom:** Frontend can't extract the instruction ID from the transaction.

**Root cause:** The function didn't return the `bytes32 instructionId` from `sendInstructions`.

**Fix:**
```solidity
// Before
function requestCreditScore(bytes calldata _encryptedPayload) external payable {
    teeExtensionRegistry.sendInstructions{value: msg.value}(teeIds, params);
}

// After
function requestCreditScore(bytes calldata _encryptedPayload) external payable returns (bytes32) {
    return teeExtensionRegistry.sendInstructions{value: msg.value}(teeIds, params);
}
```

---

## 8. Dockerfile Differences from Template

**Issues:**
- Missing `google_confidential_space_root.crt` copy (needed for TEE attestation)
- Used `su-exec` instead of `gosu` (template uses gosu)
- Missing `LABEL "tee.launch_policy.allow_env_override"="LOG_LEVEL"`

---

## Summary: What Made It Work

| Component | Key Fix |
|-----------|---------|
| ECIES encryption | Match Go's KDF (32 bytes + SHA-256 mac), random IV prepended, HMAC over IV+ciphertext |
| TEE signing | Send raw `encodePacked` bytes to `/sign` (not the hash) |
| Signature format | Normalize v from 0/1 to 27/28 |
| Machine routing | Fresh extension per Docker restart (1 machine only) |
| Timestamp | Subtract 5s buffer |
| Plaid timeout | Parallel calls + 1.5s timeout with fallback |
| Contract | Add `returns (bytes32)` to `requestCreditScore` |

---

## Current Deployed Addresses (Coston2)

| Contract | Address |
|----------|---------|
| CreditVault | `0x64cF35Cfdb4ea921588721EBAc432BaFE0B84cE7` |
| SmartAccountReceiver | `0x8a7703f4c8438628a0c778c41989Ed186AB19347` |
| InstructionSender | `0xBc136df2065B662177C163bbF2c17e5f5E9222c7` (ext 300) |
| TeeExtensionRegistry | `0x3d478d43426081BD5854be9C7c5c183bfe76C981` |
| TeeMachineRegistry | `0x5918Cd58e5caf755b8584649Aa24077822F87613` |

## 9. TEE Signer Verification Refactor

**Old approach:** `CreditVault` stored a mutable `teeSigner` address. After every Docker restart (new TEE keypair), the owner had to call `setTeeSigner(newAddress)` manually.

**New approach:** `CreditVault` now takes `TeeMachineRegistry` and `extensionId` as immutable constructor params. On `receiveScore()`, it recovers the ECDSA signer and calls `teeMachineRegistry.getExtensionId(signer)` to verify the signer is an active TEE machine for the correct extension. No manual setup step needed.

---

## 10. Frontend Retry Loop for Dead TEE Machines

**Symptom:** Credit score request goes on-chain successfully, but the TEE proxy returns 404 indefinitely. Console floods with `GET /tee-proxy/action/result/0x... 404 (Not Found)`.

**Root cause:** Same as §4 — `getRandomTeeIds()` picks a dead TEE machine. With N dead + 1 alive, there's only a `1/(N+1)` chance per attempt.

**Why §4's "fresh extension per restart" fix is hard to apply consistently:**
- The `register-tee` tool reads the extension ID from the proxy's `/info` endpoint, which reports whatever extension the TEE machine is *currently* registered for on-chain.
- A brand new Docker container (new keypair, never registered) inherits the extension from the registration process — the tools don't accept an `--extension` flag override.
- This creates a chicken-and-egg: you create extension 302 for a new InstructionSender, but `register-tee` registers the new machine to extension 300 because that's what the proxy reports.

**Pragmatic fix:** Added a retry loop in `useCreditScore.ts` that sends up to 5 on-chain `requestCreditScore` calls, each with a shorter polling window (20 attempts × 2s = 40s). If the randomly selected TEE machine is dead, the poll times out and the frontend retries with a new random selection. With 3 machines (2 dead + 1 alive), expected success within ~3 attempts.

```typescript
for (let attempt = 1; attempt <= MAX_TEE_ATTEMPTS; attempt++) {
  // send instruction on-chain (new random TEE machine each time)
  // poll for result with short timeout
  // if poll times out → retry
  // if result received → break
}
```

**Cost:** Each retry costs ~0.000001 FLR gas. Acceptable for hackathon demo.

**Proper fix (future):** The `TeeMachineRegistry` should support deregistration of dead machines, or the `register-tee` tool should accept an explicit `--extension` flag. Until then, minimize Docker restarts and redeploy everything (fresh InstructionSender + new extension) when you do.
