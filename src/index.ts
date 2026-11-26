import { Hono } from "hono";
import { parseFeed } from "@jsr/mikaelporttila__rss";
import { Feed as NewFeed } from "feed";

const app = new Hono();

// Match Fresh's default 500 body byte-for-byte ("Internal server error").
app.onError((err, c) => {
  console.error(err);
  return c.text("Internal server error", 500);
});

app.get("/api/scrapbox/:slug", async (c) => {
  const slug = c.req.param("slug");

  const project = await fetchCosensePages(slug);
  const feedFrom = await parseCosenseFeed(slug);

  const feedTo = new NewFeed({
    id: feedFrom.id,
    title: feedFrom.title.value ?? "Untitled - Cosense",
    link: feedFrom.links[0],
    description: feedFrom.description,
    docs: feedFrom.docs,
    updated: feedFrom.updateDate,
    copyright: feedFrom.copyright ?? "",
    generator: "fresh-rss-proxy",
  });

  feedFrom.entries.forEach((entry) => {
    const simpleTitle = entry.title?.value?.replace(
      new RegExp(` - ${slug} - Cosense$`, "g"),
      "",
    ) ?? "Untitled";
    const page = project.pages.find((p) => p.title === simpleTitle);

    feedTo.addItem({
      id: entry.id,
      title: simpleTitle,
      link: entry.links[0].href ?? "",
      description: entry.description?.value,
      date: entry["dc:created"] ?? new Date(),
      published: page ? new Date(page.created * 1000) : entry.published,
    });
  });

  return new Response(feedTo.rss2(), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "s-maxage=60, stale-while-revalidate",
    },
  });
});

const fetchCosensePages = async (
  slug: string,
): Promise<{
  pages: {
    title: string;
    created: number;
    updated: number;
  }[];
}> => {
  const resp = await fetch(`https://scrapbox.io/api/pages/${slug}`);

  if (resp.status > 299) {
    throw Error(`Page ${resp.url} returns ${resp.status} ${resp.body}`);
  }
  return await resp.json();
};

const parseCosenseFeed = async (slug: string) => {
  const resp = await fetch(`https://scrapbox.io/api/feed/${slug}`);

  if (resp.status > 299) {
    throw Error(`Page ${resp.url} returns ${resp.status} ${resp.body}`);
  }
  const xml = await resp.text();
  return await parseFeed(xml);
};

export default app;
