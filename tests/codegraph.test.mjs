import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readlink,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { WorkspaceManager } from "../dist/lib/codegraph.js";
import { defaultSettings } from "../dist/lib/config.js";

test("reuses a legacy CodeGraph symlink for the same source directory", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-codegraph-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const sourcePath = path.join(root, "project");
  const legacyIndex = path.join(root, "legacy-index");
  await mkdir(sourcePath);
  await mkdir(legacyIndex);
  await writeFile(
    path.join(legacyIndex, "source.json"),
    `${JSON.stringify({ sourceDir: sourcePath, version: 1 }, null, 2)}\n`,
  );
  await writeFile(path.join(legacyIndex, "codegraph.db"), "");
  await symlink(legacyIndex, path.join(sourcePath, ".codegraph"), "dir");

  const manager = new WorkspaceManager({
    ...defaultSettings,
    autoSync: false,
    autoGc: false,
    indexStore: path.join(root, "managed"),
  });
  const prepared = await manager.prepare({
    sourcePath,
    repoRoot: sourcePath,
    repoIdentity: "repo-identity",
    worktreeIdentity: "worktree-identity",
    gitCommonDir: "",
  });

  assert.equal(prepared.state, "ready");
  assert.equal(prepared.indexPath, await realpath(legacyIndex));
  assert.equal(prepared.managed, false);
  assert.equal(
    await realpath(path.join(sourcePath, ".codegraph")),
    await realpath(legacyIndex),
  );
  assert.equal(
    await readlink(path.join(sourcePath, ".codegraph")),
    legacyIndex,
  );
});

test("rejects a legacy CodeGraph symlink for a different source directory", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-codegraph-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const sourcePath = path.join(root, "project");
  const otherSourcePath = path.join(root, "other-project");
  const legacyIndex = path.join(root, "legacy-index");
  await mkdir(sourcePath);
  await mkdir(otherSourcePath);
  await mkdir(legacyIndex);
  await writeFile(
    path.join(legacyIndex, "source.json"),
    `${JSON.stringify({ sourceDir: otherSourcePath, version: 1 }, null, 2)}\n`,
  );
  await writeFile(path.join(legacyIndex, "codegraph.db"), "");
  await symlink(legacyIndex, path.join(sourcePath, ".codegraph"), "dir");

  const manager = new WorkspaceManager({
    ...defaultSettings,
    autoSync: false,
    autoGc: false,
    indexStore: path.join(root, "managed"),
  });

  await assert.rejects(
    manager.prepare({
      sourcePath,
      repoRoot: sourcePath,
      repoIdentity: "repo-identity",
      worktreeIdentity: "worktree-identity",
      gitCommonDir: "",
    }),
    /Refusing to replace an unmanaged \.codegraph symlink/,
  );
  assert.equal(
    await realpath(path.join(sourcePath, ".codegraph")),
    await realpath(legacyIndex),
  );
});

test("rejects a legacy CodeGraph symlink with an unsupported metadata version", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-codegraph-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const sourcePath = path.join(root, "project");
  const legacyIndex = path.join(root, "legacy-index");
  await mkdir(sourcePath);
  await mkdir(legacyIndex);
  await writeFile(
    path.join(legacyIndex, "source.json"),
    `${JSON.stringify({ sourceDir: sourcePath, version: 2 }, null, 2)}\n`,
  );
  await writeFile(path.join(legacyIndex, "codegraph.db"), "");
  await symlink(legacyIndex, path.join(sourcePath, ".codegraph"), "dir");

  const manager = new WorkspaceManager({
    ...defaultSettings,
    autoSync: false,
    autoGc: false,
    indexStore: path.join(root, "managed"),
  });

  await assert.rejects(
    manager.prepare({
      sourcePath,
      repoRoot: sourcePath,
      repoIdentity: "repo-identity",
      worktreeIdentity: "worktree-identity",
      gitCommonDir: "",
    }),
    /Refusing to replace an unmanaged \.codegraph symlink/,
  );
});

test("replaces a dangling managed CodeGraph symlink pointing to the managed index store", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-codegraph-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const sourcePath = path.join(root, "project");
  const managedStore = path.join(root, "managed");
  const nonExistentManagedTarget = path.join(
    managedStore,
    "projects",
    "stale-hash",
  );
  await mkdir(sourcePath);
  await mkdir(path.join(managedStore, "projects"), { recursive: true });
  await symlink(
    nonExistentManagedTarget,
    path.join(sourcePath, ".codegraph"),
    "dir",
  );

  const manager = new WorkspaceManager({
    ...defaultSettings,
    autoSync: false,
    autoGc: false,
    indexStore: managedStore,
  });
  const prepared = await manager.prepare({
    sourcePath,
    repoRoot: sourcePath,
    repoIdentity: "repo-identity",
    worktreeIdentity: "worktree-identity",
    gitCommonDir: "",
  });

  assert.equal(prepared.state, "ready");
  assert.equal(prepared.managed, true);
  const linkTarget = await realpath(path.join(sourcePath, ".codegraph"));
  assert.equal(linkTarget, prepared.indexPath);
});

test("rejects a dangling unmanaged CodeGraph symlink pointing outside the managed index store", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-codegraph-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const sourcePath = path.join(root, "project");
  const managedStore = path.join(root, "managed");
  const nonExistentOutsideTarget = path.join(root, "other-external", "deleted");
  await mkdir(sourcePath);
  await symlink(
    nonExistentOutsideTarget,
    path.join(sourcePath, ".codegraph"),
    "dir",
  );

  const manager = new WorkspaceManager({
    ...defaultSettings,
    autoSync: false,
    autoGc: false,
    indexStore: managedStore,
  });

  await assert.rejects(
    manager.prepare({
      sourcePath,
      repoRoot: sourcePath,
      repoIdentity: "repo-identity",
      worktreeIdentity: "worktree-identity",
      gitCommonDir: "",
    }),
    /Refusing to replace an unmanaged \.codegraph symlink/,
  );
});

test("gc cleans up project symlinks pointing to deleted stale managed indices", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-codegraph-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const sourcePath = path.join(root, "project");
  const managedStore = path.join(root, "managed");
  const projectIndexPath = path.join(managedStore, "projects", "stale-key");
  await mkdir(sourcePath);
  await mkdir(projectIndexPath, { recursive: true });
  await writeFile(
    path.join(projectIndexPath, ".pi-codegraph.json"),
    JSON.stringify({
      managed: true,
      sourcePath,
      repoIdentity: "old-repo",
      worktreeIdentity: "old-worktree",
    }),
  );
  await symlink(projectIndexPath, path.join(sourcePath, ".codegraph"), "dir");

  const manager = new WorkspaceManager({
    ...defaultSettings,
    autoSync: false,
    autoGc: false,
    indexStore: managedStore,
  });

  const gcResult = await manager.gc(new Set(), true);
  assert.equal(gcResult.removed.length, 1);
  assert.equal(gcResult.removed[0], projectIndexPath);

  // Symlink in project directory should have been cleaned up by gc
  let linkExists = true;
  try {
    await readlink(path.join(sourcePath, ".codegraph"));
  } catch {
    linkExists = false;
  }
  assert.equal(linkExists, false);
});
