export function SourceSetupHeader() {
  return (
    <section className="seller-surface p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div>
          <p className="text-sm font-medium text-primary">Ürün kaynağı</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
            Ürünleriniz nereden gelecek?
          </h1>
          <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
            Shopify kullanıyorsanız mağaza bilginizi hazırlayın. Shopify
            kullanmıyorsanız web siteniz için bir ürün kaynağı oluşturun.
            Ürün içe aktarma ve senkronizasyon sonraki adımlarda bu kayıtlar
            üzerinden ilerleyecek.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background/70 p-4">
          <p className="font-medium">Bu adımda yapılan</p>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
            <li>Kaynak tercihi kaydedilir.</li>
            <li>Mağaza/kaynak kayıtları oluşturulur.</li>
            <li>Shopify bağlantısı ve ürün senkronizasyonu sonraki adımda başlar.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
