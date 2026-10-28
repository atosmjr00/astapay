"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Copy, LoaderCircle, ShieldCheck, Zap } from "lucide-react";

type Product = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  slug: string;
};

type Pix = {
  orderId: string;
  transactionId: string;
  status: string;
  amountCents: number;
  pixCopyPaste: string;
  qrCodeUrl: string | null;
  expiresAt: string | null;
};

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n / 100);

const field: React.CSSProperties = {
  background: "#09090b",
  border: "1px solid #33333a",
  borderRadius: 9,
  padding: "12px 13px",
  color: "#f4f4f5",
  width: "100%",
  outline: "none",
};

const button: React.CSSProperties = {
  background: "#f4f4f5",
  color: "#09090b",
  border: 0,
  borderRadius: 10,
  padding: 14,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  cursor: "pointer",
};

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [pix, setPix] = useState<Pix | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!pix || pix.status === "PAID" || pix.status === "paid") return;

    let alive = true;
    const check = async () => {
      try {
        const response = await fetch(
          "/api/checkout/status?orderId=" +
            encodeURIComponent(pix.orderId) +
            "&slug=" +
            encodeURIComponent(slug),
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = await response.json();
        if (alive && data.status) {
          setPix((old) => (old ? { ...old, status: data.status } : old));
        }
      } catch {
        // A falha temporária de consulta não deve interromper o checkout.
      }
    };

    const timer = window.setInterval(check, 5000);
    void check();
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [pix?.orderId, pix?.status, slug]);

  useEffect(() => {
    let alive = true;
    fetch("/api/checkout/" + encodeURIComponent(slug))
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (alive) setProduct(data.product);
      })
      .catch((err: unknown) => {
        if (alive) {
          setError(err instanceof Error ? err.message : "Produto indisponível.");
        }
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  async function createPix(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;

    setBusy(true);
    setError("");
    try {
      const key = crypto.randomUUID();
      const response = await fetch("/api/pix", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": key,
        },
        body: JSON.stringify({
          productId: product.id,
          customer: {
            name,
            email,
            phone: phone || undefined,
            cpf: cpf || undefined,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao gerar Pix.");
      setPix(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao gerar Pix.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.pixCopyPaste);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione e copie o código Pix.");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#09090b",
        color: "#f4f4f5",
        display: "grid",
        placeItems: "center",
        padding: 20,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#111113",
          border: "1px solid #29292e",
          borderRadius: 20,
          padding: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontWeight: 800,
            fontSize: 20,
            marginBottom: 30,
          }}
        >
          <span style={{ background: "#f4f4f5", color: "#111", padding: 8, borderRadius: 9 }}>
            <Zap size={20} />
          </span>
          asta
          <span style={{ color: "#a1a1aa", marginLeft: -10 }}>pay</span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "#a1a1aa",
              fontWeight: 400,
              display: "flex",
              gap: 5,
              alignItems: "center",
            }}
          >
            <ShieldCheck size={14} /> Checkout seguro
          </span>
        </div>

        {!product && !error ? (
          <p>Carregando produto…</p>
        ) : error && !product ? (
          <p style={{ color: "#f87171" }}>{error}</p>
        ) : product ? (
          <>
            <p style={{ color: "#a1a1aa", fontSize: 12, marginBottom: 8 }}>
              VOCÊ ESTÁ COMPRANDO
            </p>
            <h1 style={{ fontSize: 26, margin: "0 0 8px" }}>{product.name}</h1>
            {product.description && (
              <p style={{ color: "#a1a1aa", lineHeight: 1.6 }}>{product.description}</p>
            )}
            <div style={{ fontSize: 30, fontWeight: 800, margin: "22px 0 28px" }}>
              {brl(product.price_cents)}
            </div>

            {!pix ? (
              <form onSubmit={createPix} style={{ display: "grid", gap: 14 }}>
                <label style={{ display: "grid", gap: 7, fontSize: 13 }}>
                  Nome completo
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    style={field}
                  />
                </label>
                <label style={{ display: "grid", gap: 7, fontSize: 13 }}>
                  E-mail
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    style={field}
                  />
                </label>
                <label style={{ display: "grid", gap: 7, fontSize: 13 }}>
                  Celular com DDD
                  <input required minLength={10} maxLength={15} type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} style={field} />
                </label>
                <label style={{ display: "grid", gap: 7, fontSize: 13 }}>
                  CPF
                  <input required minLength={11} maxLength={14} inputMode="numeric" value={cpf} onChange={(event) => setCpf(event.target.value)} style={field} />
                </label>
                {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
                <button disabled={busy} style={button}>
                  {busy ? <LoaderCircle size={17} /> : null}
                  {busy ? "Gerando Pix…" : "Pagar com Pix"}
                </button>
                <p style={{ fontSize: 11, color: "#777780", textAlign: "center" }}>
                  Você verá o código Pix após a geração da cobrança.
                </p>
              </form>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: "#19191d",
                    textAlign: "center",
                  }}
                >
                  {pix.qrCodeUrl && (
                    <img
                      src={pix.qrCodeUrl}
                      alt="QR Code Pix"
                      style={{
                        width: 220,
                        height: 220,
                        objectFit: "contain",
                        background: "white",
                        padding: 8,
                        borderRadius: 8,
                        margin: "0 auto 12px",
                      }}
                    />
                  )}
                  <strong>Escaneie o QR Code ou copie o Pix</strong>
                </div>
                <textarea
                  readOnly
                  value={pix.pixCopyPaste}
                  style={{ ...field, minHeight: 100, resize: "vertical" }}
                />
                <button onClick={copy} style={button}>
                  {copied ? <Check size={17} /> : <Copy size={17} />}
                  {copied ? "Pix copiado" : "Copiar código Pix"}
                </button>
                <p style={{ color: "#a1a1aa", fontSize: 12 }}>
                  Status: {pix.status}. A página consulta automaticamente o status do pedido. A
                  confirmação depende do webhook do gateway.
                </p>
              </div>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
