package com.bbqtown.dickson.ops

import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource

@Composable
internal fun OfficialBbqTownLogo(modifier: Modifier = Modifier) {
    Image(
        painter = painterResource(id = R.drawable.bbqtown_official_logo),
        contentDescription = "BBQ Town Korean BBQ Buffet logo",
        modifier = modifier,
        contentScale = ContentScale.Fit
    )
}
