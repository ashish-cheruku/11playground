"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { dictAddFromRules, dictList, type DictRule } from "@/lib/api";
import { Card, Input, Button, Label, Select, Spinner, ErrorBox, Empty, Badge } from "@/components/ui";
import { Check } from "lucide-react";

interface Row extends DictRule {
  _id: string;
}
const newRow = (): Row => ({ _id: Math.random().toString(36).slice(2), string_to_replace: "", type: "alias", alias: "" });

export default function PronunciationPage() {
  const { apiKey } = useStore();
  const [name, setName] = useState("StoryForge Audiobook Dict");
  const [description, setDescription] = useState("Character names, places, made-up vocabulary");
  const [rows, setRows] = useState<Row[]>([
    { _id: "1", string_to_replace: "Aerwyn", type: "alias", alias: "AIR-win" },
    { _id: "2", string_to_replace: "Tiraqyl", type: "phoneme", phoneme: "tiˈrɑːkɪl", alphabet: "ipa" },
  ]);
  const [existing, setExisting] = useState<{ id: string; name: string; latest_version_id: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; version_id: string } | null>(null);

  useEffect(() => {
    if (apiKey) {
      dictList(apiKey)
        .then((r) => setExisting(r.pronunciation_dictionaries || []))
        .catch(() => {});
    }
  }, [apiKey]);

  const update = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => setRows((rs) => rs.filter((r) => r._id !== id));

  const create = async () => {
    setError(null);
    setCreated(null);
    setLoading(true);
    try {
      const cleaned: DictRule[] = rows
        .filter((r) => r.string_to_replace.trim())
        .map(({ _id, ...rest }) => rest);
      const r = await dictAddFromRules(apiKey, name, cleaned, description);
      setCreated(r);
      const list = await dictList(apiKey);
      setExisting(list.pronunciation_dictionaries || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Pronunciation Dictionaries</h1>
        <p className="text-sm text-muted mt-1">
          Define how specific words should be pronounced. Apply to TTS calls via the dictionary ID.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold mb-3">Existing dictionaries</h3>
          {existing.length === 0 ? (
            <Empty>None yet.</Empty>
          ) : (
            <div className="space-y-2">
              {existing.map((d) => (
                <div key={d.id} className="bg-panel2 rounded p-3">
                  <div className="font-medium text-sm">{d.name}</div>
                  <div className="text-[11px] text-muted font-mono">id: {d.id}</div>
                  <div className="text-[11px] text-muted font-mono">version: {d.latest_version_id}</div>
                  <button
                    onClick={() => navigator.clipboard.writeText(JSON.stringify({ id: d.id, version_id: d.latest_version_id }))}
                    className="text-xs text-accent hover:underline mt-1"
                  >
                    Copy locator JSON
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold mb-3">Create new dictionary</h3>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label>Rules</Label>
              <div className="space-y-2">
                {rows.map((r) => (
                  <div key={r._id} className="bg-panel2 rounded p-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Word"
                        value={r.string_to_replace}
                        onChange={(e) => update(r._id, { string_to_replace: e.target.value })}
                      />
                      <Select value={r.type} onChange={(e) => update(r._id, { type: e.target.value as "alias" | "phoneme" })}>
                        <option value="alias">Alias (spelling hint)</option>
                        <option value="phoneme">Phoneme</option>
                      </Select>
                    </div>
                    {r.type === "alias" ? (
                      <Input
                        placeholder="Alias spelling (e.g. AIR-win)"
                        value={r.alias || ""}
                        onChange={(e) => update(r._id, { alias: e.target.value })}
                      />
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          className="col-span-2"
                          placeholder="Phoneme (e.g. tiˈrɑːkɪl)"
                          value={r.phoneme || ""}
                          onChange={(e) => update(r._id, { phoneme: e.target.value })}
                        />
                        <Select value={r.alphabet || "ipa"} onChange={(e) => update(r._id, { alphabet: e.target.value as "ipa" | "cmu-arpabet" })}>
                          <option value="ipa">IPA</option>
                          <option value="cmu-arpabet">CMU ARPAbet</option>
                        </Select>
                      </div>
                    )}
                    <div className="text-right">
                      <button onClick={() => remove(r._id)} className="text-xs text-danger hover:underline">
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setRows((rs) => [...rs, newRow()])}>+ Add rule</Button>
              </div>
            </div>
            <ErrorBox msg={error} />
            {created && (
              <div className="bg-success/10 border border-success/30 rounded p-3 text-sm">
                <div className="font-medium text-success mb-1 flex items-center gap-1.5"><Check className="w-4 h-4" strokeWidth={2} /> Dictionary created</div>
                <div className="font-mono text-xs">id: {created.id}</div>
                <div className="font-mono text-xs">version_id: {created.version_id}</div>
              </div>
            )}
            <Button onClick={create} disabled={loading}>
              {loading ? <Spinner size={14} /> : "Create dictionary"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
