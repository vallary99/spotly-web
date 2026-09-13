"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type Product } from "@/lib/api";

// Only ever rendered for a MADE_IN_KENYA business (see the dashboard's
// tab bar), but approval is checked here too — a PENDING or REJECTED
// business shouldn't see a working product form at all, matching the
// backend's own gate (Val, Sep 2026: "they will be able to post their
// products after approval").
export function DashboardProducts({
  businessId,
  approvalStatus,
  showToast,
}: {
  businessId: string;
  approvalStatus: "APPROVED" | "PENDING" | "REJECTED";
  showToast: (msg: string) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    api.products.listForBusiness(businessId).then(setProducts).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    if (approvalStatus === "APPROVED") load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, approvalStatus]);

  if (approvalStatus === "PENDING") {
    return (
      <div className="rounded-spotly border border-dashed border-border bg-surface p-8 text-center">
        <i className="bi bi-hourglass-split mb-2 block text-2xl text-terracotta" />
        <p className="text-sm text-warm-clay">
          Your Made in Kenya application is still under review. You&apos;ll be able to add products once it&apos;s approved.
        </p>
      </div>
    );
  }
  if (approvalStatus === "REJECTED") {
    return (
      <div className="rounded-spotly border border-dashed border-error bg-surface p-8 text-center">
        <i className="bi bi-x-circle mb-2 block text-2xl text-error" />
        <p className="text-sm text-warm-clay">
          Your Made in Kenya application wasn&apos;t approved. Check your email for details, or reach out to support.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-spotly border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl text-warm-brown">Products</h2>
        <button onClick={() => setCreating(true)} className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-white">
          <i className="bi bi-plus-lg mr-1.5" /> Add product
        </button>
      </div>

      {loading && <p className="py-8 text-center text-warm-clay">Loading…</p>}
      {!loading && products.length === 0 && !creating && (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-warm-clay">
          No products yet — add your first one so people can discover your catalogue.
        </div>
      )}

      {creating && (
        <ProductForm
          businessId={businessId}
          onCancel={() => setCreating(false)}
          onSaved={() => { setCreating(false); load(); }}
        />
      )}

      <div className="space-y-4">
        {products.map((p) => (
          <ProductRow key={p.id} businessId={businessId} product={p} onChanged={load} showToast={showToast} />
        ))}
      </div>
    </div>
  );
}

function ProductForm({
  businessId,
  initial,
  onCancel,
  onSaved,
}: {
  businessId: string;
  initial?: Product;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim() || !price) {
      setError("Name and price are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dto = { name: name.trim(), description: description.trim() || undefined, price: Number(price) };
      if (initial) {
        await api.products.update(businessId, initial.id, dto);
      } else {
        await api.products.create(businessId, dto);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that, try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-border bg-cream p-4">
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-semibold text-warm-clay">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-terracotta" />
      </label>
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-semibold text-warm-clay">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-terracotta"
        />
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-semibold text-warm-clay">Price (KES)</span>
        <input
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-terracotta"
        />
      </label>
      {error && <p className="mb-3 text-sm text-error">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-full border border-border bg-surface py-2 text-sm font-semibold">Cancel</button>
        <button onClick={save} disabled={busy} className="flex-1 rounded-full bg-terracotta py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function ProductRow({
  businessId,
  product,
  onChanged,
  showToast,
}: {
  businessId: string;
  product: Product;
  onChanged: () => void;
  showToast: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Sequential, not parallel — same reasoning as the gallery's own
  // multi-file upload: avoids a race where two uploads could both
  // start before either one's sortOrder is committed.
  const handlePhotoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    let succeeded = 0;
    for (const file of files) {
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const { publicUrl, storageKey } = await api.products.getImageUploadUrl(businessId, product.id, ext);
        const formData = new FormData();
        formData.append("file", file);
        await api.products.addImage(businessId, product.id, formData, `url=${encodeURIComponent(publicUrl)}&storageKey=${encodeURIComponent(storageKey)}`);
        succeeded++;
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : `Couldn't upload ${file.name}.`);
      }
    }
    if (succeeded > 0) {
      showToast(files.length === 1 ? "Photo added." : `${succeeded} of ${files.length} photos added.`);
      onChanged();
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      await api.products.removeImage(businessId, product.id, imageId);
      onChanged();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't delete that photo.");
    }
  };

  const handleDeleteProduct = async () => {
    try {
      await api.products.remove(businessId, product.id);
      showToast("Product deleted.");
      onChanged();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't delete that product.");
    }
  };

  if (editing) {
    return <ProductForm businessId={businessId} initial={product} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }} />;
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-warm-brown">{product.name}</p>
          <p className="text-sm text-terracotta">{product.currency} {product.price.toLocaleString()}</p>
          {product.description && <p className="mt-1 text-sm text-warm-clay">{product.description}</p>}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button onClick={() => setEditing(true)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-cream">Edit</button>
          <button onClick={handleDeleteProduct} className="rounded-full border border-error px-3 py-1 text-xs font-semibold text-error hover:bg-[rgba(214,90,74,0.08)]">Delete</button>
        </div>
      </div>

      {/* Same "swipe left to view the next" gallery this product's own
          public page shows — a horizontally scrollable strip here in
          the dashboard, since owner management needs to see every
          photo at once (with a delete option) rather than swiping
          through one at a time. */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {product.images.map((img) => (
          <div key={img.id} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-cream">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            <button
              onClick={() => handleDeleteImage(img.id)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
              aria-label="Delete photo"
            >
              <i className="bi bi-x text-xs" />
            </button>
          </div>
        ))}
        <label className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-warm-clay">
          {uploading ? <i className="bi bi-arrow-repeat animate-spin" /> : <i className="bi bi-plus-lg" />}
          <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoFiles} disabled={uploading} />
        </label>
      </div>
    </div>
  );
}
