# weg!gelegd (Home Item Organizer)

**weg!gelegd** is een moderne, visueel georiënteerde webapplicatie om al je voorwerpen in en rond het huis eenvoudig bij te houden en terug te vinden. De app is gebouwd met een sfeervol "Warm & Cozy" design en werkt direct op zowel je laptop als je mobiele telefoon.

---

## Belangrijke Kenmerken

1. **Visueel Huizen-overzicht**: Kamers worden getoond met foto's op het hoofddashboard.
2. **Kasten & Planken (Sub-locaties)**: Organiseer voorwerpen per kamer in specifieke kasten of opbergplekken.
3. **Slimme Zoekbalk**: Zoek direct in al je kamers en kasten op naam, categorie of omschrijving.
4. **Status van Voorwerpen**: Geef per voorwerp aan of het *Aanwezig*, *Uitgeleend* (inclusief aan wie) of *Kwijt* is.
5. **Dubbele Modus**:
   - **Demo-modus (Offline)**: Werkt direct in elke browser met data die lokaal in je browser (`localStorage`) wordt bewaard. Ideaal om te testen of offline te gebruiken.
   - **Supabase-modus (Cloud)**: Synchroniseert je gegevens en foto's real-time tussen al je apparaten via een gratis cloud-database.

---

## Supabase Opzetten (Cloud-synchronisatie)

Volg deze eenvoudige stappen om de database en foto-opslag in te stellen:

### 1. Maak een Supabase project aan
1. Ga naar [supabase.com](https://supabase.com) en log in (of registreer een gratis account).
2. Maak een nieuw project aan genaamd `weg-gelegd`.

### 2. Voer de SQL Database-tabelscripts uit
1. Ga in het linkermenu van je Supabase dashboard naar de **SQL Editor**.
2. Klik op **New Query**.
3. Plak de volgende SQL-code in het venster en klik rechtsonder op **Run** (dit maakt de tabellen aan, schakelt Row-Level Security (RLS) in en stelt openbare rechten in zodat de app correct kan communiceren met je database):

```sql
-- 1. Kamers Tabel
CREATE TABLE rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sub-locaties Tabel (kasten, dozen, etc.)
CREATE TABLE sub_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Voorwerpen (Items) Tabel
CREATE TABLE items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  sub_location_id UUID REFERENCES sub_locations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'Aanwezig',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Schakel Row-Level Security (RLS) in en sta openbare toegang toe (nodig omdat de app zonder login werkt)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access for rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Allow public insert access for rooms" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access for rooms" ON rooms FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access for rooms" ON rooms FOR DELETE USING (true);

ALTER TABLE sub_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access for sub_locations" ON sub_locations FOR SELECT USING (true);
CREATE POLICY "Allow public insert access for sub_locations" ON sub_locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access for sub_locations" ON sub_locations FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access for sub_locations" ON sub_locations FOR DELETE USING (true);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access for items" ON items FOR SELECT USING (true);
CREATE POLICY "Allow public insert access for items" ON items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access for items" ON items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access for items" ON items FOR DELETE USING (true);
```

### 3. Maak een Storage Bucket voor foto's
Om foto's van je kamers en voorwerpen te kunnen opslaan:
1. Ga in het linkermenu naar **Storage**.
2. Klik op **New Bucket**.
3. Noem de bucket exact: `photos`.
4. Zet de schakelaar op **Public** (zodat de app de geüploade foto's kan weergeven).
5. Klik op **Create Bucket**.

*(Optioneel)* Als je problemen ervaart met uploaden, voeg dan de volgende Storage Policies toe in Supabase via **Storage > Policies**:
- Sta `SELECT`, `INSERT`, `UPDATE` en `DELETE` toe voor anonieme/openbare gebruikers.

---

## Configuratie in de App

1. Open `index.html` in je browser.
2. Klik rechtsboven in de navigatiebalk op het **tandwiel-icoon** (<i class="fa-solid fa-gear"></i>).
3. Ga in je Supabase dashboard naar **Project Settings (tandwiel) > API**.
4. Kopieer de **Project URL** en de **anon public API Key**.
5. Plak deze in het formulier in de app en klik op **Instellingen opslaan**.
6. De statusbalk kleurt nu groen: **"Verbonden met Supabase"**!

---

## Deployment naar Netlify

Je kunt de app eenvoudig gratis online zetten, zodat je er altijd vanaf je telefoon bij kunt:

1. Zorg dat je code op **GitHub** staat.
2. Log in op [Netlify](https://www.netlify.com/).
3. Klik op **Add new site** > **Import an existing project**.
4. Selecteer je GitHub repository `weg-gelegd`.
5. Netlify herkent automatisch dat dit een statische site is. Laat de build-commando's leeg en klik op **Deploy**.
6. Je site is nu online! Open de URL op je telefoon en vul via de instellingen je Supabase credentials in.
