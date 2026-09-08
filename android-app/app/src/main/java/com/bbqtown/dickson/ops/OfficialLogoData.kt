package com.bbqtown.dickson.ops

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight

private val OFFICIAL_LOGO_BASE64 =
    "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" +
    "+JOC6i+3G2ysqaZlJb2gMgliLw/z1b+QQHtbxzPbeGXXmss74gKjkiEzDLh+YHG4ytkXGVX+DXK41NndBFQsa8ZnDhLnc4IGNl7xXwhLfrVR22hmp6Okp3h5" +
    "YYiQSOgAB6dVsuvCslXwkbJQPpqPnACZzIiGnzIA6ZIQEayccVF4IkFmfHSmndOZmzB+ABs0gDYnHRV1L7TamprhSDh6oEoMesc0EsDyACRj1VvwtwrWcPzy" +
    "Pkq6Z0ZgbE2Kng5YLh87vMrywcL19q4kuN2qqynmNw/mNZEWluOmDnogOkmraanmihnnijlmOI2OcAXn0HdQOJ6iqpLFUVNHOYZIRrLwwOOkddisLtwtbrzd" +
    "KC41jZDPQnMWl2Ad87j6r3ivJ4broxHI8yRlmI2aiM98KH6L4/zRxxvdzi1trbzrZLQOqWAxNYMkENGfPKm8KVUs1+oo3SPePwxrnFzicknqqeKKKo8VVS1f" +
    "Lht7oP41MQAQCQ5TuC3D/UdKOv8A2tn7rFN7R33K4Po+joiLc80IiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiIDVPTQ1TNFREyVmc6XtyMpNTQ1DQ2aJkjWnID2ggFbUQnbPBsvURCAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAxexr2lrwHNIwQdwVqjo6aKUSRwRMeG6Q5rADjy+i3og2EREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREB//2Q=="

@Composable
internal fun OfficialBbqTownLogo(modifier: Modifier = Modifier) {
    val image = remember {
        runCatching {
            val bytes = Base64.decode(OFFICIAL_LOGO_BASE64, Base64.NO_WRAP)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
        }.getOrNull()
    }

    if (image != null) {
        Image(
            bitmap = image,
            contentDescription = "BBQ Town Korean BBQ Buffet logo",
            modifier = modifier,
            contentScale = ContentScale.Fit
        )
    } else {
        Box(modifier, contentAlignment = Alignment.Center) {
            Text("BBQ TOWN", fontWeight = FontWeight.Black)
        }
    }
}
