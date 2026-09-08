package com.bbqtown.dickson.ops

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Crash-safe BBQ Town brand lockup.
 *
 * Alpha5 decoded an embedded bitmap at composition time. On some Android
 * devices BitmapFactory can return null for that payload, which caused an
 * immediate crash when asImageBitmap() was called. Keep startup completely
 * resource-free here so the app always opens; the exact raster logo can be
 * restored as a normal Android drawable once the binary asset is committed.
 */
@Composable
internal fun OfficialBbqTownLogo(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .background(Color.White, RoundedCornerShape(8.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "BBQ TOWN",
                color = Color(0xFFC8A36A),
                fontWeight = FontWeight.Black,
                fontSize = 18.sp,
                letterSpacing = 0.4.sp
            )
            Spacer(Modifier.height(1.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .width(22.dp)
                        .height(3.dp)
                        .background(Color(0xFFD64536), RoundedCornerShape(2.dp))
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    text = "KOREAN BBQ BUFFET",
                    color = Color(0xFF1D211F),
                    fontWeight = FontWeight.Bold,
                    fontSize = 7.sp,
                    letterSpacing = 0.7.sp
                )
            }
        }
        Spacer(Modifier.width(8.dp))
        Box(
            modifier = Modifier
                .size(26.dp)
                .background(Color(0xFFD64536), RoundedCornerShape(8.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text("BBQ", color = Color.White, fontWeight = FontWeight.Black, fontSize = 7.sp)
        }
    }
}
