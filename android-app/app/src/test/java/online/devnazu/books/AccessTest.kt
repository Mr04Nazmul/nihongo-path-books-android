package online.devnazu.books
import org.junit.Test
import org.junit.Assert.*
class AccessTest {
 @Test fun strictReaderOrigin(){assertTrue(Access.internal("https://appassets.androidplatform.net/assets/reader/n5.html"));listOf("https://evil.example/n5.html","https://appassets.androidplatform.net.evil.example/assets/reader/n5.html","http://appassets.androidplatform.net/assets/reader/n5.html","file:///etc/passwd","https://appassets.androidplatform.net/assets/reader/../secret","https://appassets.androidplatform.net:444/assets/reader/n5.html").forEach{assertFalse(it,Access.internal(it))}}
 @Test fun oldWebsitePagesCannotOpen(){
  listOf("kanji.html?level=N5","study.html?level=N5","listening.html?level=N5","basics/index.html").forEach{assertTrue(it,Access.readerScreen(it))}
  listOf("pdf-reader.html?level=N4","index.html","n5.html","settings.html","progress.html","lessons.html","../index.html","basics/../index.html").forEach{assertFalse(it,Access.readerScreen(it))}
 }
 @Test fun previewsAreLevelBoundAndPdfIsDenied(){
  assertEquals("reader/previews/kanji/n5.json",Access.previewAsset("kanji/n5.json","N5"))
  assertEquals("reader/previews/strokes/n5/05c71.json",Access.previewAsset("strokes/n5/05c71.json","N5"))
  assertNull(Access.previewAsset("kanji/n2.json","N5"))
  assertNull(Access.previewAsset("strokes/n2/05c71.json","N5"))
  assertNull(Access.previewAsset("pdfs/n5-grammar.pdf","N5"))
  assertNotNull(Access.previewAsset("kanji/n1.json","N1"))
 }
 @Test fun exactInitialCosts(){assertEquals(listOf(2,5,10,20),Access.thresholds["N5"]);assertEquals(listOf(6,15,25,45),Access.thresholds["N1"]);assertEquals(5,Access.thresholds.size);assertTrue(Access.levels.contains("N1"))}
 @Test fun listeningAssetsRemainLevelBound(){
  assertEquals("N5",Access.contentLevel("listening/n5/2018/g1/audio.mp3"))
  assertEquals("N3",Access.contentLevel("listening/n3/catalog.json"))
  assertEquals("N1",Access.contentLevel("listening/n1/catalog.json"))
  assertNull(Access.freeListeningAsset("listening/n5/2018/g1/audio.mp3","N5"))
  assertEquals("reader/previews/listening/n5/catalog.json",Access.freeListeningAsset("listening/n5/catalog.json","N5"))
  for(group in 1..2)for(file in listOf("audio.mp3","answers.json","q1.webp","p3.webp"))assertNotNull(Access.freeListeningAsset("listening/n5/2012/g$group/$file","N5"))
  for(path in listOf("listening/n5/2012/g3/audio.mp3","listening/n5/2009/g1/audio.mp3","listening/n2/2012/g1/audio.mp3","listening/n1/2012/g1/audio.mp3","listening/n5/2012/g1/../g3/audio.mp3"))assertNull(path,Access.freeListeningAsset(path,"N5"))
 }
 @Test fun expiredAccessNeverNegative(){assertEquals(0L,Access.remaining(100,101));assertEquals(50L,Access.remaining(150,100))}
}
